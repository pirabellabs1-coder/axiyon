"""LinkedIn search tool — sourcing leads/candidates by ICP."""
from __future__ import annotations

import hashlib
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec

NAME = "linkedin.search"


def _mock_leads(icp: str, n: int) -> list[dict]:
    seed = hashlib.sha256(icp.encode()).digest()
    leads: list[dict] = []
    first_names = ["Sarah", "Léa", "Marc", "Yuki", "Priya", "Diego", "Emma", "Tomás"]
    last_names = ["Chen", "Dupont", "Petit", "Schmidt", "Martin", "Reis", "Okazaki", "Karasek"]
    industries = ["SaaS", "Fintech", "Healthtech", "Retail", "Industry"]
    for i in range(n):
        idx = seed[i % len(seed)]
        fn = first_names[idx % len(first_names)]
        ln = last_names[(idx + i) % len(last_names)]
        company = f"{ln.lower()}-co-{idx % 99}"
        leads.append(
            {
                "id": f"li-{uuid.uuid5(uuid.NAMESPACE_DNS, fn + ln + company).hex[:12]}",
                "first_name": fn,
                "last_name": ln,
                "email": f"{fn.lower()}.{ln.lower()}@{company}.com",
                "company": company,
                "title": "VP " + (icp.split()[1] if len(icp.split()) > 1 else "Data"),
                "industry": industries[idx % len(industries)],
                "linkedin_url": f"https://linkedin.com/in/{fn.lower()}-{ln.lower()}",
            }
        )
    return leads


async def _handler(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    icp = str(args.get("icp", ""))
    n = int(args.get("n", 50))
    n = max(1, min(n, 500))
    return {"leads": _mock_leads(icp, n), "icp": icp, "count": n}


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name=NAME,
            description="Search LinkedIn for leads matching an ICP description.",
            parameters={
                "type": "object",
                "properties": {
                    "icp": {"type": "string", "description": "ICP description"},
                    "n": {"type": "integer", "minimum": 1, "maximum": 500, "default": 50},
                },
                "required": ["icp"],
            },
            handler=_handler,
        )
    )
