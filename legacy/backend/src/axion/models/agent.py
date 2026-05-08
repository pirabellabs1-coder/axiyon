"""Agent catalog (templates) and Agent instances (deployed for an Org)."""
from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from axion.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from axion.models.org import Org
    from axion.models.task import Task


class AgentStatus(str, enum.Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"
    ARCHIVED = "archived"


class Agent(Base, UUIDMixin, TimestampMixin):
    """Catalog template — read-only blueprint shared across all orgs.

    Loaded from `axion.agents.catalog` at startup.
    """

    __tablename__ = "agent_templates"

    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(8), default="🤖", nullable=False)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    default_tools: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    price_eur_monthly: Mapped[int] = mapped_column(Integer, default=299, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AgentInstance(Base, UUIDMixin, TimestampMixin):
    """A deployed agent owned by an Org, with overridden config."""

    __tablename__ = "agent_instances"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[AgentStatus] = mapped_column(
        Enum(AgentStatus, name="agent_status"),
        default=AgentStatus.IDLE,
        nullable=False,
        index=True,
    )
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    enabled_tools: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    custom_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_clone_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    budget_per_day_eur: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    health_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    tasks_today: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_run_at: Mapped[str | None] = mapped_column(String(32), nullable=True)

    org: Mapped[Org] = relationship("Org", back_populates="agents")
    tasks: Mapped[list[Task]] = relationship(
        "Task", back_populates="agent", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AgentInstance {self.name} ({self.template_slug})>"
