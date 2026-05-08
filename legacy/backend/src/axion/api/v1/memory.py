"""Memory routes — semantic recall + KG queries + ingest."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from axion.db.session import get_session
from axion.deps import get_current_org_id
from axion.memory.store import MemoryStore
from axion.models.memory import MemoryKind

router = APIRouter()


class MemoryIngestRequest(BaseModel):
    content: str = Field(min_length=1)
    kind: MemoryKind = MemoryKind.SEMANTIC
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    source: str | None = None
    metadata: dict = Field(default_factory=dict)
    agent_id: uuid.UUID | None = None


class MemoryRecallRequest(BaseModel):
    query: str = Field(min_length=1)
    k: int = Field(default=8, ge=1, le=64)
    kind: MemoryKind | None = None
    min_importance: float = 0.0


@router.post("/ingest", status_code=201)
async def ingest(
    payload: MemoryIngestRequest,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    store = MemoryStore(session)
    entry = await store.ingest(
        org_id=org_id,
        content=payload.content,
        kind=payload.kind,
        importance=payload.importance,
        source=payload.source,
        metadata=payload.metadata,
        agent_id=payload.agent_id,
    )
    return {"id": str(entry.id), "kind": entry.kind.value}


@router.post("/recall")
async def recall(
    payload: MemoryRecallRequest,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    store = MemoryStore(session)
    items = await store.recall(
        org_id=org_id,
        query=payload.query,
        k=payload.k,
        kind=payload.kind,
        min_importance=payload.min_importance,
    )
    return items


@router.get("/kg/{node_id}")
async def get_kg_node(
    node_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    store = MemoryStore(session)
    return await store.get_kg_node(org_id, node_id)


@router.get("/export")
async def export_memory(
    kind: MemoryKind | None = Query(default=None),
    limit: int = Query(default=10000, ge=1, le=100000),
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Full export — your memory is yours."""
    store = MemoryStore(session)
    return await store.export(org_id, kind=kind, limit=limit)
