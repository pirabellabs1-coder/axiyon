"""Memory system: vector entries, episodic memory, knowledge graph nodes."""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import JSON, Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from axion.db.base import Base, TimestampMixin, UUIDMixin


class MemoryKind(str, enum.Enum):
    SEMANTIC = "semantic"     # facts, learned patterns
    EPISODIC = "episodic"     # past events
    PROCEDURAL = "procedural" # how-to / SOPs
    CLIENT = "client"         # client-specific
    TASK = "task"             # task results


class MemoryEntry(Base, UUIDMixin, TimestampMixin):
    """A single piece of memory, vector-indexed for retrieval."""

    __tablename__ = "memory_entries"
    __table_args__ = (
        Index("ix_memory_org_kind", "org_id", "kind"),
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_instances.id"), nullable=True
    )
    kind: Mapped[MemoryKind] = mapped_column(
        Enum(MemoryKind, name="memory_kind"), default=MemoryKind.SEMANTIC, nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(Float), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


class KnowledgeNode(Base, UUIDMixin, TimestampMixin):
    """A node in the org's knowledge graph (entities + relationships)."""

    __tablename__ = "knowledge_nodes"
    __table_args__ = (
        Index("ix_kg_org_type", "org_id", "node_type"),
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    node_type: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    properties: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    edges: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # [{type, target_id}]
