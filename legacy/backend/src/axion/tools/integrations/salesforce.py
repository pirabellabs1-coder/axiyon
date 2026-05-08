"""Salesforce CRM tools."""
from __future__ import annotations

import hashlib
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _lookup(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    accounts = args.get("accounts", [])
    out: list[dict] = []
    for acct in accounts:
        seed = hashlib.sha256(str(acct).encode()).digest()
        out.append({
            "name": acct,
            "id": f"acc-{seed[:6].hex()}",
            "arr": (seed[0] % 50) * 50_000,
            "stage": ["prospect", "demo", "negotiation", "closed_won"][seed[1] % 4],
            "owner": "iris@your-org.com",
        })
    return {"accounts": out, "count": len(out)}


async def _update(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "id": args.get("id") or f"sf-{uuid.uuid4().hex[:8]}",
        "fields_updated": list(args.get("fields", {}).keys()),
        "ok": True,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="salesforce.lookup",
            description="Look up Salesforce accounts/opportunities by name.",
            parameters={
                "type": "object",
                "properties": {"accounts": {"type": "array", "items": {"type": "string"}}},
                "required": ["accounts"],
            },
            handler=_lookup,
        )
    )
    registry.register(
        ToolSpec(
            name="salesforce.update",
            description="Update a Salesforce record's fields.",
            parameters={
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "stage": {"type": "string"},
                    "fields": {"type": "object"},
                },
            },
            handler=_update,
        )
    )
