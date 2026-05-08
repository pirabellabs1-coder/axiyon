"""Agent registry: maps template slugs to BaseAgent subclasses + dispatches tasks."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from axion.agents.base import AgentContext, AgentResult, BaseAgent
from axion.db.session import async_session_maker
from axion.llm.router import LLMRouter
from axion.memory.store import MemoryStore
from axion.models.agent import AgentInstance, AgentStatus
from axion.models.task import Task, TaskStatus
from axion.tools.registry import ToolRegistry

log = structlog.get_logger(__name__)


class AgentRegistry:
    """Singleton mapping slug → BaseAgent subclass."""

    def __init__(self) -> None:
        self._classes: dict[str, type[BaseAgent]] = {}
        self._llm = LLMRouter()
        self._tools = ToolRegistry()

    def register(self, slug: str, cls: type[BaseAgent]) -> None:
        self._classes[slug] = cls

    def get(self, slug: str) -> type[BaseAgent] | None:
        return self._classes.get(slug)

    async def execute_task(self, task_id: uuid.UUID) -> AgentResult:
        """Synchronous-style task execution. Used by Celery worker or test harness."""
        async with async_session_maker() as session:
            return await self._execute_in_session(task_id, session)

    async def dispatch_task(self, task_id: uuid.UUID) -> None:
        """Schedule a task — in production goes to Celery; in dev runs in background."""
        from axion.config import get_settings
        settings = get_settings()
        if settings.is_production:
            from axion.workers.celery_app import run_task
            run_task.delay(str(task_id))
        else:
            asyncio.create_task(self.execute_task(task_id))

    async def _execute_in_session(
        self, task_id: uuid.UUID, session: AsyncSession
    ) -> AgentResult:
        task = await session.get(Task, task_id)
        if not task:
            log.error("task_not_found", task_id=str(task_id))
            return AgentResult(success=False, error="Task not found")
        agent_inst = await session.get(AgentInstance, task.agent_id)
        if not agent_inst:
            return AgentResult(success=False, error="Agent instance not found")

        cls = self.get(agent_inst.template_slug)
        if cls is None:
            from axion.agents.instances.generic import GenericAgent
            cls = GenericAgent

        ctx = AgentContext(
            org_id=task.org_id,
            agent_instance_id=agent_inst.id,
            task_id=task.id,
            workflow_run_id=task.workflow_run_id,
            objective=task.objective,
            inputs=task.input_payload or {},
            config=agent_inst.config or {},
            enabled_tools=agent_inst.enabled_tools or [],
            custom_prompt=agent_inst.custom_prompt,
            budget_remaining_eur=float(agent_inst.budget_per_day_eur),
            session=session,
            llm=self._llm,
            tools=self._tools,
            memory=MemoryStore(session),
        )
        agent = cls(ctx)

        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        await session.flush()

        try:
            result = await agent.run()
        except Exception as e:  # noqa: BLE001
            log.exception("agent_run_failed", task_id=str(task_id))
            result = AgentResult(success=False, error=str(e))

        # Persist outcome
        task.finished_at = datetime.utcnow()
        if task.started_at:
            task.duration_ms = int((task.finished_at - task.started_at).total_seconds() * 1000)
        task.tokens_in = result.tokens_in
        task.tokens_out = result.tokens_out
        task.cost_eur = result.cost_eur
        task.model_used = result.model_used
        task.output_payload = result.output
        task.error = result.error
        task.trace_id = ctx.trace_id
        task.status = TaskStatus.SUCCEEDED if result.success else TaskStatus.FAILED

        agent_inst.status = AgentStatus.IDLE if result.success else AgentStatus.ERROR
        if result.success:
            agent_inst.health_score = min(1.0, agent_inst.health_score * 0.95 + 0.05)
        else:
            agent_inst.health_score = max(0.0, agent_inst.health_score - 0.05)

        await session.commit()
        return result


_registry: AgentRegistry | None = None


def get_registry() -> AgentRegistry:
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
        _bootstrap(_registry)
    return _registry


def _bootstrap(registry: AgentRegistry) -> None:
    """Wire all agent implementations into the registry."""
    from axion.agents.instances.atlas_cfo import AtlasCFO
    from axion.agents.instances.codex_legal import CodexLegal
    from axion.agents.instances.generic import GenericAgent
    from axion.agents.instances.iris_sdr import IrisSDR
    from axion.agents.instances.nova_recruiter import NovaRecruiter
    from axion.agents.instances.sage_support import SageSupport

    registry.register("sdr-outbound", IrisSDR)
    registry.register("cfo-assistant", AtlasCFO)
    registry.register("support-l2", SageSupport)
    registry.register("legal-counsel", CodexLegal)
    registry.register("recruiter", NovaRecruiter)
    # Generic fallback for catalogued templates without a Python impl
    for slug in ("bdr-inbound", "account-executive", "voice-support",
                 "bookkeeper", "devops", "growth-marketer",
                 "content-writer", "data-engineer", "project-manager"):
        registry.register(slug, GenericAgent)
