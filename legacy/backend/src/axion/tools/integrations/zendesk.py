"""Zendesk support tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _update(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "ticket_id": args.get("ticket_id") or f"zd-{uuid.uuid4().hex[:8]}",
        "status": args.get("status", "solved"),
        "ok": True,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="zendesk.update",
            description="Reply to and/or update a Zendesk ticket.",
            parameters={
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string"},
                    "comment": {"type": "string"},
                    "status": {"type": "string", "enum": ["open", "pending", "solved", "closed"]},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["ticket_id"],
            },
            handler=_update,
        )
    )
