"""QuickBooks accounting tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _lookup(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    period = args.get("period", "current_month")
    report = args.get("report", "trial_balance")
    return {
        "period": period,
        "report": report,
        "totals": {
            "assets_eur": 1_840_000,
            "liabilities_eur": 720_000,
            "equity_eur": 1_120_000,
            "revenue_eur": 1_540_000,
            "expenses_eur": 980_000,
        },
        "currency": "EUR",
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="quickbooks.lookup",
            description="Pull a financial report from QuickBooks.",
            parameters={
                "type": "object",
                "properties": {
                    "period": {"type": "string"},
                    "report": {"type": "string", "enum": ["trial_balance", "p_and_l", "cash_flow"]},
                },
            },
            handler=_lookup,
        )
    )
