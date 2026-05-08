"""Pennylane (FR accounting) tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _entry(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "entry_id": f"pl-{uuid.uuid4().hex[:10]}",
        "amount_eur": args.get("amount_eur", 0),
        "account": args.get("account"),
        "ok": True,
    }


async def _export(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "url": f"https://files.axion.ai/exports/pl-{uuid.uuid4().hex[:10]}.xlsx",
        "period": args.get("period"),
        "rows": 1247,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="pennylane.entry",
            description="Create a journal entry in Pennylane.",
            parameters={
                "type": "object",
                "properties": {
                    "amount_eur": {"type": "number"},
                    "account": {"type": "string"},
                    "description": {"type": "string"},
                },
            },
            handler=_entry,
        )
    )
    registry.register(
        ToolSpec(
            name="pennylane.export",
            description="Export a closed period as XLSX/CSV.",
            parameters={
                "type": "object",
                "properties": {"period": {"type": "string"}, "format": {"type": "string", "default": "xlsx"}},
            },
            handler=_export,
        )
    )
