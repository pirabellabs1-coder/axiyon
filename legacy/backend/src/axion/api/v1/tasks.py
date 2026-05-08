"""Task list/get routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.db.session import get_session
from axion.deps import get_current_org_id
from axion.models.task import Task, TaskStatus
from axion.schemas.task import TaskOut

router = APIRouter()


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    agent_id: uuid.UUID | None = Query(default=None),
    workflow_run_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[Task]:
    stmt = select(Task).where(Task.org_id == org_id)
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if agent_id:
        stmt = stmt.where(Task.agent_id == agent_id)
    if workflow_run_id:
        stmt = stmt.where(Task.workflow_run_id == workflow_run_id)
    stmt = stmt.order_by(Task.created_at.desc()).limit(limit).offset(offset)
    rows = await session.scalars(stmt)
    return list(rows.all())


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> Task:
    t = await session.get(Task, task_id)
    if not t or t.org_id != org_id:
        raise HTTPException(404, "Task not found")
    return t


@router.post("/{task_id}/cancel", status_code=204)
async def cancel_task(
    task_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    t = await session.get(Task, task_id)
    if not t or t.org_id != org_id:
        raise HTTPException(404, "Task not found")
    if t.status not in (TaskStatus.QUEUED, TaskStatus.RUNNING):
        raise HTTPException(409, f"Cannot cancel task in state {t.status.value}")
    t.status = TaskStatus.CANCELLED
