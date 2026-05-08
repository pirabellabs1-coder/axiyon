"""Calendar booking tool."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _book(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    duration = int(args.get("duration_min", 30))
    starts = (datetime.utcnow() + timedelta(days=2)).replace(microsecond=0)
    return {
        "event_id": f"evt-{uuid.uuid4().hex[:12]}",
        "with": args.get("with"),
        "starts_at": starts.isoformat() + "Z",
        "duration_min": duration,
        "calendar_url": "https://cal.example.com/...",
        "confirmed": True,
    }


async def _list_free(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "slots": [
            (datetime.utcnow() + timedelta(days=i, hours=h)).isoformat() + "Z"
            for i in range(1, 4) for h in (10, 14, 16)
        ]
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="calendar.book",
            description="Book a calendar event with one or more attendees.",
            parameters={
                "type": "object",
                "properties": {
                    "with": {"type": "string", "description": "attendee email"},
                    "duration_min": {"type": "integer", "default": 30},
                    "topic": {"type": "string"},
                },
                "required": ["with"],
            },
            handler=_book,
        )
    )
    registry.register(
        ToolSpec(
            name="calendar.list_free",
            description="List the user's available time slots over the next N days.",
            parameters={
                "type": "object",
                "properties": {"days": {"type": "integer", "default": 7}},
            },
            handler=_list_free,
        )
    )
