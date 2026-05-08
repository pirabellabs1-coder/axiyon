"""Linear issue tracking tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _create_issue(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "id": f"LIN-{uuid.uuid4().hex[:6].upper()}",
        "title": args.get("title"),
        "url": "https://linear.app/...",
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="linear.create_issue",
            description="Open an issue in Linear.",
            parameters={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "team": {"type": "string"},
                    "priority": {"type": "integer", "minimum": 0, "maximum": 4},
                },
                "required": ["title"],
            },
            handler=_create_issue,
        )
    )
