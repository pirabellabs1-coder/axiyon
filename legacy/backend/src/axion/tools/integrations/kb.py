"""Internal knowledge base search."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.memory.store import MemoryStore
from axion.tools.registry import ToolRegistry, ToolSpec


async def _search(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    query = args.get("query", "")
    k = int(args.get("k", 5))
    store = MemoryStore(session)
    items = await store.recall(org_id=org_id, query=query, k=k)
    return {"hits": items, "query": query, "count": len(items)}


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="kb.search",
            description="Search the org's knowledge base / documentation / past resolutions.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "k": {"type": "integer", "default": 5, "minimum": 1, "maximum": 30},
                },
                "required": ["query"],
            },
            handler=_search,
        )
    )
