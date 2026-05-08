"""GitHub tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _list_prs(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "prs": [
            {"number": 1284, "title": "Fix race condition in workflow engine", "state": "open"},
            {"number": 1283, "title": "Add Mistral provider", "state": "merged"},
        ]
    }


async def _create_issue(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "number": int(uuid.uuid4().int) % 9999,
        "url": f"https://github.com/{args.get('repo','axion/api')}/issues/{args.get('title','new')[:5]}",
        "ok": True,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="github.list_prs",
            description="List open and recently merged pull requests.",
            parameters={"type": "object", "properties": {"repo": {"type": "string"}}},
            handler=_list_prs,
        )
    )
    registry.register(
        ToolSpec(
            name="github.create_issue",
            description="Open a GitHub issue.",
            parameters={
                "type": "object",
                "properties": {
                    "repo": {"type": "string"},
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title"],
            },
            handler=_create_issue,
        )
    )
