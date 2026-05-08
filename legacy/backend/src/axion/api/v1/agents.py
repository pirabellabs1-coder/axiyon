"""Agent catalog + instances + ad-hoc runs."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.agents.catalog import CATALOG, get_template
from axion.agents.registry import get_registry
from axion.core import audit
from axion.core.rbac import require_role
from axion.db.session import get_session
from axion.deps import get_current_org_id, get_current_user
from axion.models.agent import AgentInstance, AgentStatus
from axion.models.org import OrgRole
from axion.models.task import Task, TaskStatus
from axion.schemas.agent import (
    AgentInstanceCreate,
    AgentInstanceOut,
    AgentInstanceUpdate,
    AgentRunRequest,
    AgentTemplateOut,
)
from axion.schemas.auth import CurrentUser
from axion.schemas.task import TaskOut

router = APIRouter()


# ─── Catalog ─────────────────────────────────────────────────────────


@router.get("/catalog", response_model=list[AgentTemplateOut])
async def list_catalog(
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search across name/role/description"),
) -> list[dict]:
    items = list(CATALOG.values())
    if category:
        items = [t for t in items if t.category == category]
    if q:
        ql = q.lower()
        items = [
            t for t in items
            if ql in t.name.lower() or ql in t.role.lower() or ql in t.description.lower()
        ]
    return [t.model_dump() for t in items]


@router.get("/catalog/{slug}", response_model=AgentTemplateOut)
async def get_catalog_item(slug: str) -> dict:
    template = get_template(slug)
    if not template:
        raise HTTPException(404, f"Agent template '{slug}' not found")
    return template.model_dump()


# ─── Instances ───────────────────────────────────────────────────────


@router.get("", response_model=list[AgentInstanceOut])
async def list_instances(
    status_filter: AgentStatus | None = Query(default=None, alias="status"),
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[AgentInstance]:
    stmt = select(AgentInstance).where(AgentInstance.org_id == org_id)
    if status_filter:
        stmt = stmt.where(AgentInstance.status == status_filter)
    stmt = stmt.order_by(AgentInstance.created_at.desc())
    rows = await session.scalars(stmt)
    return list(rows.all())


@router.post("", response_model=AgentInstanceOut, status_code=201)
async def hire_agent(
    payload: AgentInstanceCreate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.BUILDER)),
    session: AsyncSession = Depends(get_session),
) -> AgentInstance:
    """Hire a new agent — instantiate a template for this org."""
    template = get_template(payload.template_slug)
    if not template:
        raise HTTPException(404, f"Unknown template: {payload.template_slug}")

    instance = AgentInstance(
        org_id=org_id,
        template_slug=payload.template_slug,
        name=payload.name,
        config=payload.config,
        enabled_tools=payload.enabled_tools or template.default_tools,
        custom_prompt=payload.custom_prompt,
        voice_clone_id=payload.voice_clone_id,
        budget_per_day_eur=payload.budget_per_day_eur,
    )
    session.add(instance)
    await session.flush()

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="agent.hire",
        resource_type="agent_instance",
        resource_id=str(instance.id),
        payload={"template": payload.template_slug, "name": payload.name},
    )
    return instance


@router.get("/{agent_id}", response_model=AgentInstanceOut)
async def get_instance(
    agent_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> AgentInstance:
    inst = await session.get(AgentInstance, agent_id)
    if not inst or inst.org_id != org_id:
        raise HTTPException(404, "Agent not found")
    return inst


@router.patch("/{agent_id}", response_model=AgentInstanceOut)
async def update_instance(
    agent_id: uuid.UUID,
    payload: AgentInstanceUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.BUILDER)),
    session: AsyncSession = Depends(get_session),
) -> AgentInstance:
    inst = await session.get(AgentInstance, agent_id)
    if not inst or inst.org_id != org_id:
        raise HTTPException(404, "Agent not found")

    for field in ("name", "config", "enabled_tools", "custom_prompt", "budget_per_day_eur", "status"):
        v = getattr(payload, field)
        if v is not None:
            setattr(inst, field, v)
    await session.flush()

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="agent.update",
        resource_type="agent_instance",
        resource_id=str(inst.id),
        payload=payload.model_dump(exclude_unset=True),
    )
    return inst


@router.delete("/{agent_id}", status_code=204)
async def delete_instance(
    agent_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> None:
    inst = await session.get(AgentInstance, agent_id)
    if not inst or inst.org_id != org_id:
        raise HTTPException(404, "Agent not found")
    await session.delete(inst)
    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="agent.delete",
        resource_type="agent_instance",
        resource_id=str(agent_id),
    )


@router.post("/{agent_id}/run", response_model=TaskOut, status_code=202)
async def run_agent(
    agent_id: uuid.UUID,
    payload: AgentRunRequest,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.OPERATOR)),
    session: AsyncSession = Depends(get_session),
) -> Task:
    """Trigger an ad-hoc run of an agent on a specific objective."""
    inst = await session.get(AgentInstance, agent_id)
    if not inst or inst.org_id != org_id:
        raise HTTPException(404, "Agent not found")
    if inst.status == AgentStatus.PAUSED:
        raise HTTPException(409, "Agent is paused")

    task = Task(
        org_id=org_id,
        agent_id=agent_id,
        objective=payload.objective,
        input_payload=payload.inputs,
        status=TaskStatus.QUEUED,
    )
    session.add(task)
    await session.flush()

    # Dispatch via registry — runs asynchronously through Celery in production
    registry = get_registry()
    await registry.dispatch_task(task.id)

    inst.status = AgentStatus.RUNNING
    inst.last_run_at = datetime.utcnow().isoformat()
    inst.tasks_today += 1

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="agent.run",
        resource_type="task",
        resource_id=str(task.id),
        payload={"agent_id": str(agent_id), "objective": payload.objective[:200]},
    )
    return task


@router.post("/{agent_id}/pause", status_code=204)
async def pause_agent(
    agent_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    _: CurrentUser = Depends(require_role(OrgRole.OPERATOR)),
    session: AsyncSession = Depends(get_session),
) -> None:
    inst = await session.get(AgentInstance, agent_id)
    if not inst or inst.org_id != org_id:
        raise HTTPException(404, "Agent not found")
    inst.status = AgentStatus.PAUSED


@router.post("/{agent_id}/resume", status_code=204)
async def resume_agent(
    agent_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    _: CurrentUser = Depends(require_role(OrgRole.OPERATOR)),
    session: AsyncSession = Depends(get_session),
) -> None:
    inst = await session.get(AgentInstance, agent_id)
    if not inst or inst.org_id != org_id:
        raise HTTPException(404, "Agent not found")
    inst.status = AgentStatus.IDLE
