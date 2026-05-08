"""Slack messaging tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _post(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "ts": str(uuid.uuid4().int)[:16],
        "channel": args.get("channel"),
        "ok": True,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="slack.post",
            description="Post a message to a Slack channel or DM.",
            parameters={
                "type": "object",
                "properties": {
                    "channel": {"type": "string"},
                    "text": {"type": "string"},
                    "blocks": {"type": "array"},
                },
                "required": ["channel", "text"],
            },
            handler=_post,
        )
    )
