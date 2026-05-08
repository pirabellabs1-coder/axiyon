"""Audit log routes."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core.audit import verify_chain
from axion.core.rbac import require_role
from axion.db.session import get_session
from axion.deps import get_current_org_id
from axion.models.audit import AuditLog
from axion.models.org import OrgRole
from axion.schemas.auth import CurrentUser

router = APIRouter()


@router.get("")
async def list_audit_logs(
    actor_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    org_id: uuid.UUID = Depends(get_current_org_id),
    _: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    stmt = select(AuditLog).where(AuditLog.org_id == org_id)
    if actor_type:
        stmt = stmt.where(AuditLog.actor_type == actor_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if since:
        stmt = stmt.where(AuditLog.created_at >= since)
    stmt = stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    rows = await session.scalars(stmt)
    return [
        {
            "id": str(r.id),
            "created_at": r.created_at.isoformat(),
            "actor_type": r.actor_type,
            "actor_id": r.actor_id,
            "action": r.action,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "payload": r.payload,
            "record_hash": r.record_hash,
            "prev_hash": r.prev_hash,
        }
        for r in rows.all()
    ]


@router.post("/verify")
async def verify_audit_chain(
    org_id: uuid.UUID = Depends(get_current_org_id),
    _: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Re-verify the cryptographic chain for this org's audit log."""
    ok, n = await verify_chain(session, org_id)
    return {"ok": ok, "records_verified": n}
