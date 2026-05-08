"""Workflow execution engine.

Executes a `WorkflowSpec` step by step, respecting:
- dependencies (DAG)
- timeouts and retries
- approval gates
- escalation on failure
- multi-agent handoffs

Each step's input/output is persisted as a `WorkflowStep` row.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.agents.registry import get_registry
from axion.config import get_settings
from axion.db.session import async_session_maker
from axion.models.agent import AgentInstance
from axion.models.task import Task, TaskStatus
from axion.models.workflow import (
    Workflow,
    WorkflowRun,
    WorkflowRunStatus,
    WorkflowStep,
)
from axion.schemas.workflow import WorkflowSpec, WorkflowStepSpec

log = structlog.get_logger(__name__)
settings = get_settings()


class WorkflowEngine:
    """Singleton engine that executes WorkflowRuns."""

    def __init__(self) -> None:
        self._registry = get_registry()

    async def dispatch_run(self, run_id: uuid.UUID) -> None:
        """Schedule a run for execution."""
        if settings.is_production:
            from axion.workers.celery_app import run_workflow
            run_workflow.delay(str(run_id))
        else:
            asyncio.create_task(self.execute_run(run_id))

    async def execute_run(self, run_id: uuid.UUID) -> None:
        """Execute a workflow run end-to-end."""
        async with async_session_maker() as session:
            await self._execute(run_id, session)

    async def _execute(self, run_id: uuid.UUID, session: AsyncSession) -> None:
        run = await session.get(WorkflowRun, run_id)
        if not run:
            log.error("run_not_found", run_id=str(run_id))
            return
        wf = await session.get(Workflow, run.workflow_id)
        if not wf:
            run.status = WorkflowRunStatus.FAILED
            run.error = "Workflow not found"
            await session.commit()
            return

        try:
            spec = WorkflowSpec.model_validate(wf.spec)
        except Exception as e:  # noqa: BLE001
            run.status = WorkflowRunStatus.FAILED
            run.error = f"Invalid spec: {e}"
            await session.commit()
            return

        run.status = WorkflowRunStatus.RUNNING
        run.started_at = datetime.utcnow()
        await session.flush()

        # Build state: outputs of completed steps, keyed by step.id
        state: dict[str, Any] = {"inputs": run.inputs, **run.inputs}
        completed: set[str] = set()
        steps_by_id = {s.id: s for s in spec.steps}
        order = self._topo_sort(spec.steps)

        for idx, step_id in enumerate(order):
            step = steps_by_id[step_id]
            # Check budget cap on the run
            if spec.max_cost_eur and run.cost_eur >= spec.max_cost_eur:
                run.status = WorkflowRunStatus.FAILED
                run.error = f"Workflow cost cap reached: {run.cost_eur} >= {spec.max_cost_eur}"
                break

            row = await self._execute_step(
                session, run, wf.org_id, step, idx, state
            )

            run.cost_eur = float(run.cost_eur or 0) + float(state.get("__last_cost", 0))
            await session.flush()

            if row.status == "succeeded":
                completed.add(step.id)
                state[step.id] = row.output_state
                state["last_output"] = row.output_state
            elif row.status == "awaiting_approval":
                run.status = WorkflowRunStatus.AWAITING_APPROVAL
                await session.commit()
                return
            else:  # failed
                if step.on_failure == "continue":
                    continue
                if step.on_failure == "escalate":
                    await self._escalate(spec, run, step, row.error)
                    run.status = WorkflowRunStatus.FAILED
                    run.error = f"Escalated on step {step.id}: {row.error}"
                else:
                    run.status = WorkflowRunStatus.FAILED
                    run.error = f"Step {step.id} failed: {row.error}"
                break
        else:
            run.status = WorkflowRunStatus.SUCCEEDED

        run.outputs = {k: v for k, v in state.items() if k in completed}
        run.finished_at = datetime.utcnow()
        await session.commit()

    async def _execute_step(
        self,
        session: AsyncSession,
        run: WorkflowRun,
        org_id: uuid.UUID,
        step: WorkflowStepSpec,
        idx: int,
        state: dict[str, Any],
    ) -> WorkflowStep:
        """Run a single step with retries + timeout. Persists a WorkflowStep row."""
        # Resolve agent instance: by name or by template slug, fallback to creating an ephemeral one
        agent_inst = await session.scalar(
            select(AgentInstance).where(
                AgentInstance.org_id == org_id,
                AgentInstance.template_slug == step.agent,
            ).limit(1)
        )
        if not agent_inst:
            agent_inst = await session.scalar(
                select(AgentInstance).where(
                    AgentInstance.org_id == org_id,
                    AgentInstance.name == step.agent,
                ).limit(1)
            )

        wf_step = WorkflowStep(
            run_id=run.id,
            step_index=idx,
            step_id=step.id,
            agent_id=agent_inst.id if agent_inst else None,
            status="running",
            started_at=datetime.utcnow(),
            input_state={**step.params, "_state": state},
        )
        session.add(wf_step)
        await session.flush()

        if not agent_inst:
            wf_step.status = "failed"
            wf_step.error = f"No agent instance found for slug/name: {step.agent}"
            wf_step.finished_at = datetime.utcnow()
            return wf_step

        # Approval gate (pre-execution, by spec)
        if step.requires_approval and not state.get(f"_approval_granted:{step.id}"):
            wf_step.status = "awaiting_approval"
            wf_step.finished_at = datetime.utcnow()
            return wf_step

        # Build a Task and execute through registry
        objective = state.get("inputs", {}).get("objective") or step.params.get("objective", step.action)
        task = Task(
            org_id=org_id,
            agent_id=agent_inst.id,
            workflow_run_id=run.id,
            objective=objective,
            input_payload={**step.params, "action": step.action, "_state": state},
        )
        session.add(task)
        await session.flush()

        # Retry loop
        last_err: str | None = None
        result = None
        for attempt in range(step.retry + 1):
            try:
                result = await asyncio.wait_for(
                    self._registry.execute_task(task.id),
                    timeout=step.timeout_s,
                )
                if result.success or result.requires_approval:
                    break
                last_err = result.error or "agent reported failure"
            except asyncio.TimeoutError:
                last_err = f"timeout after {step.timeout_s}s"
            except Exception as e:  # noqa: BLE001
                last_err = f"{type(e).__name__}: {e}"
            await asyncio.sleep(min(2 ** attempt, 30))

        if result is None:
            wf_step.status = "failed"
            wf_step.error = last_err or "unknown failure"
        elif result.requires_approval:
            wf_step.status = "awaiting_approval"
        else:
            wf_step.status = "succeeded" if result.success else "failed"
            wf_step.error = result.error
            wf_step.output_state = result.output
            wf_step.tool_calls = [tc.to_dict() for tc in result.tool_calls]
            state["__last_cost"] = result.cost_eur

        wf_step.finished_at = datetime.utcnow()
        await session.flush()
        return wf_step

    @staticmethod
    def _topo_sort(steps: list[WorkflowStepSpec]) -> list[str]:
        """Kahn's algorithm. Raises if there's a cycle."""
        deps = {s.id: set(s.depends_on) for s in steps}
        result: list[str] = []
        ready = [s.id for s in steps if not s.depends_on]
        while ready:
            n = ready.pop(0)
            result.append(n)
            for s in steps:
                if n in deps[s.id]:
                    deps[s.id].discard(n)
                    if not deps[s.id] and s.id not in result and s.id not in ready:
                        ready.append(s.id)
        if len(result) != len(steps):
            raise ValueError("Workflow has a cycle")
        return result

    async def _escalate(
        self, spec: WorkflowSpec, run: WorkflowRun, step: WorkflowStepSpec, error: str | None
    ) -> None:
        target = (spec.on_blocker or {}).get("escalate_to")
        if not target:
            return
        log.warning(
            "workflow_escalation",
            run_id=str(run.id),
            step=step.id,
            target=target,
            error=error,
        )


_engine: WorkflowEngine | None = None


def get_engine() -> WorkflowEngine:
    global _engine
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine
