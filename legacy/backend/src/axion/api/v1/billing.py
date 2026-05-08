"""Billing routes — subscription state, invoices, usage."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core.rbac import require_role
from axion.db.session import get_session
from axion.deps import get_current_org_id
from axion.models.billing import Invoice, Subscription, Tier
from axion.models.org import OrgRole
from axion.models.task import Task, TaskStatus
from axion.schemas.auth import CurrentUser

router = APIRouter()


class TierChangeRequest(BaseModel):
    tier: Tier
    annual: bool = False


@router.get("/subscription")
async def get_subscription(
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    sub = await session.scalar(select(Subscription).where(Subscription.org_id == org_id))
    if not sub:
        return {"tier": "solo", "status": "trialing", "seats": 1, "annual_billing": False}
    return {
        "tier": sub.tier.value,
        "status": sub.status.value,
        "seats": sub.seats,
        "annual_billing": sub.annual_billing,
        "period_start": sub.period_start.isoformat() if sub.period_start else None,
        "period_end": sub.period_end.isoformat() if sub.period_end else None,
        "cancel_at_period_end": sub.cancel_at_period_end,
    }


@router.post("/subscription/change")
async def change_tier(
    payload: TierChangeRequest,
    org_id: uuid.UUID = Depends(get_current_org_id),
    _: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    sub = await session.scalar(select(Subscription).where(Subscription.org_id == org_id))
    if not sub:
        sub = Subscription(org_id=org_id, tier=payload.tier, annual_billing=payload.annual)
        session.add(sub)
    else:
        sub.tier = payload.tier
        sub.annual_billing = payload.annual
    await session.flush()
    return {"tier": sub.tier.value, "annual_billing": sub.annual_billing}


@router.get("/usage")
async def get_usage(
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Live usage for the current billing period."""
    period_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_tasks = await session.scalar(
        select(func.count(Task.id)).where(
            Task.org_id == org_id,
            Task.created_at >= period_start,
            Task.status == TaskStatus.SUCCEEDED,
        )
    ) or 0
    total_cost = await session.scalar(
        select(func.coalesce(func.sum(Task.cost_eur), 0.0)).where(
            Task.org_id == org_id,
            Task.created_at >= period_start,
        )
    ) or 0.0
    total_tokens = await session.scalar(
        select(func.coalesce(func.sum(Task.tokens_in + Task.tokens_out), 0)).where(
            Task.org_id == org_id,
            Task.created_at >= period_start,
        )
    ) or 0

    return {
        "period_start": period_start.isoformat(),
        "tasks_used": int(total_tasks),
        "cost_eur": round(float(total_cost), 4),
        "tokens": int(total_tokens),
    }


@router.get("/invoices")
async def list_invoices(
    limit: int = 24,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    rows = await session.scalars(
        select(Invoice)
        .where(Invoice.org_id == org_id)
        .order_by(Invoice.created_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(r.id),
            "number": r.number,
            "amount_eur": r.amount_eur,
            "tax_eur": r.tax_eur,
            "status": r.status,
            "issued_at": r.issued_at.isoformat() if r.issued_at else None,
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
            "pdf_url": r.pdf_url,
        }
        for r in rows.all()
    ]
