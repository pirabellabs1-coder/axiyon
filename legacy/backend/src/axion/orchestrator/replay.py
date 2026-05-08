"""Replay subsystem: reconstruct full state of a past WorkflowRun.

Allows time-travel debugging and "what if I changed input X" scenarios.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.models.workflow import WorkflowRun, WorkflowStep


async def reconstruct(session: AsyncSession, run_id: uuid.UUID) -> dict[str, Any]:
    """Walk every step of a run, returning the full reconstructed state."""
    run = await session.get(WorkflowRun, run_id)
    if not run:
        return {}
    rows = await session.scalars(
        select(WorkflowStep)
        .where(WorkflowStep.run_id == run_id)
        .order_by(WorkflowStep.step_index.asc())
    )
    steps = list(rows.all())
    return {
        "run_id": str(run.id),
        "workflow_id": str(run.workflow_id),
        "status": run.status.value,
        "inputs": run.inputs,
        "outputs": run.outputs,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "cost_eur": run.cost_eur,
        "steps": [
            {
                "step_index": s.step_index,
                "step_id": s.step_id,
                "agent_id": str(s.agent_id) if s.agent_id else None,
                "status": s.status,
                "input": s.input_state,
                "output": s.output_state,
                "tool_calls": s.tool_calls,
                "error": s.error,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            }
            for s in steps
        ],
    }
