"""Memory store tests (offline / hash-embed mode)."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from axion.memory.store import MemoryStore
from axion.models.memory import MemoryKind
from axion.models.org import Org


@pytest.mark.asyncio
async def test_ingest_and_recall(session: AsyncSession):
    org = Org(name="Acme", slug=f"acme-{uuid.uuid4().hex[:6]}")
    session.add(org)
    await session.flush()

    store = MemoryStore(session)
    await store.ingest(
        org_id=org.id,
        content="Stripe is one of our top 5 customers. ARR signal: 18.5M€",
        kind=MemoryKind.CLIENT,
        importance=0.9,
        source="crm",
    )
    await store.ingest(
        org_id=org.id,
        content="Internal SOP: contracts above 100k€ require legal review",
        kind=MemoryKind.PROCEDURAL,
        importance=0.95,
    )
    await session.flush()

    hits = await store.recall(org_id=org.id, query="contract approval threshold", k=5)
    assert hits, "expected at least one recall hit"
    # Sanity: at least one hit is the procedural SOP we ingested
    assert any("100k€" in (h.get("content") or "") for h in hits)
