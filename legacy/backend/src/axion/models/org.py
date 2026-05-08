"""Organizations & memberships."""
from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from axion.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from axion.models.agent import AgentInstance
    from axion.models.billing import Subscription
    from axion.models.user import User
    from axion.models.workflow import Workflow


class OrgRole(str, enum.Enum):
    """Role hierarchy. Higher = more permissions."""

    VIEWER = "viewer"
    OPERATOR = "operator"   # can run agents
    BUILDER = "builder"     # can create workflows
    ADMIN = "admin"         # can manage org, billing
    OWNER = "owner"         # founding admin, cannot be removed


class Org(Base, UUIDMixin, TimestampMixin):
    """A customer organization (tenant)."""

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region: Mapped[str] = mapped_column(String(32), default="eu-west-3", nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    task_quota_monthly: Mapped[int] = mapped_column(Integer, default=25_000, nullable=False)
    voice_minutes_monthly: Mapped[int] = mapped_column(Integer, default=1_000, nullable=False)
    budget_eur_monthly: Mapped[int] = mapped_column(Integer, default=5_000, nullable=False)

    members: Mapped[list[OrgMember]] = relationship(
        "OrgMember", back_populates="org", cascade="all, delete-orphan"
    )
    agents: Mapped[list[AgentInstance]] = relationship(
        "AgentInstance", back_populates="org", cascade="all, delete-orphan"
    )
    workflows: Mapped[list[Workflow]] = relationship(
        "Workflow", back_populates="org", cascade="all, delete-orphan"
    )
    subscription: Mapped[Subscription | None] = relationship(
        "Subscription", back_populates="org", uselist=False
    )


class OrgMember(Base, UUIDMixin, TimestampMixin):
    """User-Org membership with role."""

    __table_args__ = (UniqueConstraint("user_id", "org_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[OrgRole] = mapped_column(
        Enum(OrgRole, name="org_role"), default=OrgRole.OPERATOR, nullable=False
    )

    user: Mapped[User] = relationship("User", back_populates="memberships")
    org: Mapped[Org] = relationship("Org", back_populates="members")
