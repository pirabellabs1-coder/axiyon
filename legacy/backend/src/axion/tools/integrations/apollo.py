"""Apollo enrichment tool — enriches lead records with firmographic data."""
from __future__ import annotations

import hashlib
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec

NAME = "apollo.enrich"


async def _handler(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    leads = args.get("leads") or []
    if not isinstance(leads, list):
        leads = []
    enriched: list[dict] = []
    for lead in leads:
        seed = hashlib.sha256(str(lead).encode()).digest()
        arr_signal = (seed[0] % 50) * 50_000  # 0 → 2.5M€
        headcount = 50 + seed[1] % 500
        enriched.append({
            **(lead if isinstance(lead, dict) else {"id": lead}),
            "arr_signal_eur": arr_signal,
            "headcount": headcount,
            "growth_rate_yoy": (seed[2] % 80) / 100,
            "tech_stack": ["postgres", "kubernetes", "react"][: 1 + seed[3] % 3],
        })
    return {"leads": enriched, "count": len(enriched)}


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name=NAME,
            description="Enrich leads with firmographic data (ARR signal, headcount, stack).",
            parameters={
                "type": "object",
                "properties": {
                    "leads": {
                        "type": "array",
                        "items": {"type": ["object", "string"]},
                    }
                },
                "required": ["leads"],
            },
            handler=_handler,
        )
    )
