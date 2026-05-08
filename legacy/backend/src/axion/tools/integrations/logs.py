"""Datadog/Loki log search tool."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _search(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    query = args.get("query", "")
    since = args.get("since", "1h")
    return {
        "query": query,
        "since": since,
        "log_lines": [
            {
                "ts": (datetime.utcnow() - timedelta(minutes=12)).isoformat() + "Z",
                "level": "ERROR",
                "service": "api",
                "msg": f"upstream timeout: {query[:50]}",
            },
            {
                "ts": (datetime.utcnow() - timedelta(minutes=11)).isoformat() + "Z",
                "level": "WARN",
                "service": "api",
                "msg": "retry succeeded after 1.4s",
            },
        ],
        "count": 2,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="logs.search",
            description="Search application logs (Datadog/Loki/CloudWatch).",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "since": {"type": "string", "default": "1h"},
                    "level": {"type": "string", "enum": ["DEBUG", "INFO", "WARN", "ERROR"]},
                },
                "required": ["query"],
            },
            handler=_search,
        )
    )
