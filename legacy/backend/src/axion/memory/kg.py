"""Knowledge graph — entities + relationships per org."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.models.memory import KnowledgeNode


async def build_kg_node(
    session: AsyncSession,
    org_id: uuid.UUID,
    node_type: str,
    label: str,
    properties: dict | None = None,
) -> KnowledgeNode:
    """Upsert a node by (org_id, node_type, label)."""
    existing = await session.scalar(
        select(KnowledgeNode).where(
            KnowledgeNode.org_id == org_id,
            KnowledgeNode.node_type == node_type,
            KnowledgeNode.label == label,
        )
    )
    if existing:
        if properties:
            existing.properties = {**existing.properties, **properties}
        await session.flush()
        return existing
    node = KnowledgeNode(
        org_id=org_id,
        node_type=node_type,
        label=label,
        properties=properties or {},
        edges=[],
    )
    session.add(node)
    await session.flush()
    return node


async def link_nodes(
    session: AsyncSession,
    org_id: uuid.UUID,
    from_id: uuid.UUID,
    to_id: uuid.UUID,
    edge_type: str,
) -> None:
    src = await session.get(KnowledgeNode, from_id)
    if not src or src.org_id != org_id:
        return
    edge = {"type": edge_type, "target_id": str(to_id)}
    if edge not in src.edges:
        src.edges = src.edges + [edge]
    await session.flush()


async def get_node(session: AsyncSession, org_id: uuid.UUID, node_id: uuid.UUID) -> dict[str, Any]:
    n = await session.get(KnowledgeNode, node_id)
    if not n or n.org_id != org_id:
        return {}
    return {
        "id": str(n.id),
        "type": n.node_type,
        "label": n.label,
        "properties": n.properties,
        "edges": n.edges,
    }


async def neighborhood(
    session: AsyncSession, org_id: uuid.UUID, node_id: uuid.UUID, depth: int = 1
) -> list[dict[str, Any]]:
    seen: set[str] = {str(node_id)}
    frontier = [str(node_id)]
    out: list[dict[str, Any]] = []
    for _ in range(depth):
        next_frontier: list[str] = []
        for nid in frontier:
            n = await session.get(KnowledgeNode, uuid.UUID(nid))
            if not n or n.org_id != org_id:
                continue
            out.append(
                {
                    "id": str(n.id),
                    "type": n.node_type,
                    "label": n.label,
                    "properties": n.properties,
                }
            )
            for e in n.edges:
                tid = e.get("target_id")
                if tid and tid not in seen:
                    seen.add(tid)
                    next_frontier.append(tid)
        frontier = next_frontier
    return out
