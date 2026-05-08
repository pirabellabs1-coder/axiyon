"""Stripe payments tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _list_charges(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "charges": [
            {"id": f"ch_{uuid.uuid4().hex[:14]}", "amount_eur": 199.0, "status": "succeeded"},
            {"id": f"ch_{uuid.uuid4().hex[:14]}", "amount_eur": 599.0, "status": "succeeded"},
        ],
        "total_eur": 798.0,
        "period": args.get("period", "current_month"),
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="stripe.list_charges",
            description="List Stripe charges over a billing period.",
            parameters={
                "type": "object",
                "properties": {"period": {"type": "string"}, "status": {"type": "string"}},
            },
            handler=_list_charges,
        )
    )
