"""Memory store — orchestrates vector recall, episodic logs, and KG."""
from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.memory.embeddings import embed_text
from axion.memory.kg import build_kg_node, get_node, link_nodes
from axion.models.memory import KnowledgeNode, MemoryEntry, MemoryKind


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class MemoryStore:
    """High-level facade over the memory tables. Used by agents + API routes."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ingest(
        self,
        *,
        org_id: uuid.UUID,
        content: str,
        kind: MemoryKind = MemoryKind.SEMANTIC,
        importance: float = 0.5,
        source: str | None = None,
        metadata: dict[str, Any] | None = None,
        agent_id: uuid.UUID | None = None,
    ) -> MemoryEntry:
        embedding = await embed_text(content)
        summary = content[:200] if len(content) > 200 else content
        entry = MemoryEntry(
            org_id=org_id,
            agent_id=agent_id,
            kind=kind,
            content=content,
            summary=summary,
            embedding=embedding,
            importance=importance,
            source=source,
            metadata_=metadata or {},
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def recall(
        self,
        *,
        org_id: uuid.UUID,
        query: str,
        k: int = 8,
        kind: MemoryKind | None = None,
        min_importance: float = 0.0,
    ) -> list[dict[str, Any]]:
        """Semantic search. In production we use pgvector cosine; here we
        re-implement client-side for portability."""
        q_emb = await embed_text(query)

        stmt = select(MemoryEntry).where(MemoryEntry.org_id == org_id)
        if kind:
            stmt = stmt.where(MemoryEntry.kind == kind)
        if min_importance > 0:
            stmt = stmt.where(MemoryEntry.importance >= min_importance)
        stmt = stmt.order_by(MemoryEntry.created_at.desc()).limit(500)
        rows = (await self.session.scalars(stmt)).all()

        scored = [
            (_cosine(q_emb, r.embedding or []) * (0.5 + r.importance), r)
            for r in rows
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:k]
        return [
            {
                "id": str(r.id),
                "kind": r.kind.value,
                "content": r.content,
                "summary": r.summary,
                "importance": r.importance,
                "score": round(score, 4),
                "metadata": r.metadata_,
                "created_at": r.created_at.isoformat(),
            }
            for score, r in top
        ]

    async def get_kg_node(self, org_id: uuid.UUID, node_id: uuid.UUID) -> dict[str, Any]:
        return await get_node(self.session, org_id, node_id)

    async def upsert_kg(
        self,
        org_id: uuid.UUID,
        node_type: str,
        label: str,
        properties: dict | None = None,
    ) -> KnowledgeNode:
        return await build_kg_node(self.session, org_id, node_type, label, properties)

    async def link(
        self,
        org_id: uuid.UUID,
        from_id: uuid.UUID,
        to_id: uuid.UUID,
        edge_type: str,
    ) -> None:
        await link_nodes(self.session, org_id, from_id, to_id, edge_type)

    async def export(
        self,
        org_id: uuid.UUID,
        *,
        kind: MemoryKind | None = None,
        limit: int = 10000,
    ) -> list[dict[str, Any]]:
        stmt = select(MemoryEntry).where(MemoryEntry.org_id == org_id)
        if kind:
            stmt = stmt.where(MemoryEntry.kind == kind)
        stmt = stmt.order_by(MemoryEntry.created_at.desc()).limit(limit)
        rows = (await self.session.scalars(stmt)).all()
        return [
            {
                "id": str(r.id),
                "kind": r.kind.value,
                "content": r.content,
                "metadata": r.metadata_,
                "importance": r.importance,
                "source": r.source,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
