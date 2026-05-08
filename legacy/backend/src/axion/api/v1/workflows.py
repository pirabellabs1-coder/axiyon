"""Workflow CRUD + run + replay routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core import audit
from axion.core.rbac import require_role
from axion.db.session import get_session
from axion.deps import get_current_org_id
from axion.models.org import OrgRole
from axion.models.workflow import (
    Workflow,
    WorkflowRun,
    WorkflowRunStatus,
    WorkflowStatus,
    WorkflowStep,
)
from axion.orchestrator.engine import get_engine
from axion.schemas.auth import CurrentUser
from axion.schemas.workflow import (
    WorkflowCreate,
    WorkflowOut,
    WorkflowRunOut,
    WorkflowRunRequest,
)

router = APIRouter()


@router.get("", response_model=list[WorkflowOut])
async def list_workflows(
    status_filter: WorkflowStatus | None = Query(default=None, alias="status"),
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[Workflow]:
    """Return latest version per slug."""
    sub = (
        select(
            Workflow.slug,
            func.max(Workflow.version).label("max_v"),
        )
        .where(Workflow.org_id == org_id)
        .group_by(Workflow.slug)
        .subquery()
    )
    stmt = (
        select(Workflow)
        .join(sub, (Workflow.slug == sub.c.slug) & (Workflow.version == sub.c.max_v))
        .where(Workflow.org_id == org_id)
        .order_by(desc(Workflow.created_at))
    )
    if status_filter:
        stmt = stmt.where(Workflow.status == status_filter)
    rows = await session.scalars(stmt)
    return list(rows.all())


@router.post("", response_model=WorkflowOut, status_code=201)
async def create_or_version(
    payload: WorkflowCreate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.BUILDER)),
    session: AsyncSession = Depends(get_session),
) -> Workflow:
    """Create a new workflow (or new version of an existing slug)."""
    last = await session.scalar(
        select(Workflow)
        .where(Workflow.org_id == org_id, Workflow.slug == payload.slug)
        .order_by(Workflow.version.desc())
        .limit(1)
    )
    next_version = (last.version + 1) if last else 1

    wf = Workflow(
        org_id=org_id,
        slug=payload.slug,
        name=payload.spec.name,
        description=payload.spec.description,
        version=next_version,
        status=WorkflowStatus.DRAFT,
        spec=payload.spec.model_dump(),
        schedule_cron=payload.spec.schedule_cron,
    )
    session.add(wf)
    await session.flush()

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="workflow.create",
        resource_type="workflow",
        resource_id=str(wf.id),
        payload={"slug": payload.slug, "version": next_version},
    )
    return wf


@router.get("/{slug}", response_model=WorkflowOut)
async def get_workflow(
    slug: str,
    version: int | None = Query(default=None),
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> Workflow:
    stmt = select(Workflow).where(Workflow.org_id == org_id, Workflow.slug == slug)
    if version is not None:
        stmt = stmt.where(Workflow.version == version)
    else:
        stmt = stmt.order_by(Workflow.version.desc())
    wf = await session.scalar(stmt.limit(1))
    if not wf:
        raise HTTPException(404, "Workflow not found")
    return wf


@router.post("/{slug}/publish", response_model=WorkflowOut)
async def publish_workflow(
    slug: str,
    version: int | None = Query(default=None),
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> Workflow:
    stmt = select(Workflow).where(Workflow.org_id == org_id, Workflow.slug == slug)
    if version is not None:
        stmt = stmt.where(Workflow.version == version)
    else:
        stmt = stmt.order_by(Workflow.version.desc())
    wf = await session.scalar(stmt.limit(1))
    if not wf:
        raise HTTPException(404, "Workflow not found")
    wf.status = WorkflowStatus.PUBLISHED
    await session.flush()

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="workflow.publish",
        resource_type="workflow",
        resource_id=str(wf.id),
    )
    return wf


@router.post("/{slug}/run", response_model=WorkflowRunOut, status_code=202)
async def run_workflow(
    slug: str,
    payload: WorkflowRunRequest,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.OPERATOR)),
    session: AsyncSession = Depends(get_session),
) -> WorkflowRun:
    wf = await session.scalar(
        select(Workflow)
        .where(
            Workflow.org_id == org_id,
            Workflow.slug == slug,
            Workflow.status == WorkflowStatus.PUBLISHED,
        )
        .order_by(Workflow.version.desc())
        .limit(1)
    )
    if not wf:
        raise HTTPException(404, "No published workflow with this slug")

    run = WorkflowRun(
        workflow_id=wf.id,
        org_id=org_id,
        inputs=payload.inputs,
        triggered_by=payload.triggered_by,
        status=WorkflowRunStatus.PENDING,
    )
    session.add(run)
    await session.flush()

    engine = get_engine()
    await engine.dispatch_run(run.id)

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="workflow.run",
        resource_type="workflow_run",
        resource_id=str(run.id),
        payload={"workflow_slug": slug, "version": wf.version},
    )
    return run


@router.get("/runs/{run_id}", response_model=WorkflowRunOut)
async def get_run(
    run_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> WorkflowRun:
    run = await session.get(WorkflowRun, run_id)
    if not run or run.org_id != org_id:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/runs/{run_id}/steps")
async def get_run_steps(
    run_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    run = await session.get(WorkflowRun, run_id)
    if not run or run.org_id != org_id:
        raise HTTPException(404, "Run not found")
    rows = await session.scalars(
        select(WorkflowStep)
        .where(WorkflowStep.run_id == run_id)
        .order_by(WorkflowStep.step_index.asc())
    )
    return [
        {
            "id": str(s.id),
            "step_index": s.step_index,
            "step_id": s.step_id,
            "agent_id": str(s.agent_id) if s.agent_id else None,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            "tool_calls": s.tool_calls,
            "error": s.error,
        }
        for s in rows.all()
    ]


@router.post("/runs/{run_id}/cancel", status_code=204)
async def cancel_run(
    run_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.OPERATOR)),
    session: AsyncSession = Depends(get_session),
) -> None:
    run = await session.get(WorkflowRun, run_id)
    if not run or run.org_id != org_id:
        raise HTTPException(404, "Run not found")
    if run.status not in (WorkflowRunStatus.PENDING, WorkflowRunStatus.RUNNING, WorkflowRunStatus.AWAITING_APPROVAL):
        raise HTTPException(409, f"Cannot cancel run in state {run.status.value}")
    run.status = WorkflowRunStatus.CANCELLED
    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="workflow.cancel",
        resource_type="workflow_run",
        resource_id=str(run_id),
    )


@router.post("/runs/{run_id}/replay", response_model=WorkflowRunOut, status_code=202)
async def replay_run(
    run_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.BUILDER)),
    session: AsyncSession = Depends(get_session),
) -> WorkflowRun:
    """Time-travel: re-execute a past run with the same inputs."""
    src = await session.get(WorkflowRun, run_id)
    if not src or src.org_id != org_id:
        raise HTTPException(404, "Run not found")

    new_run = WorkflowRun(
        workflow_id=src.workflow_id,
        org_id=org_id,
        inputs=src.inputs,
        triggered_by=f"replay:{run_id}",
        status=WorkflowRunStatus.PENDING,
    )
    session.add(new_run)
    await session.flush()

    engine = get_engine()
    await engine.dispatch_run(new_run.id)

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="workflow.replay",
        resource_type="workflow_run",
        resource_id=str(new_run.id),
        payload={"replays": str(run_id)},
    )
    return new_run
