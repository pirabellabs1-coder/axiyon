"""Billing: subscriptions, invoices, usage tracking."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from axion.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from axion.models.org import Org


class Tier(str, enum.Enum):
    SOLO = "solo"
    GROWTH = "growth"
    ENTERPRISE = "enterprise"


class SubStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"


class BillingAccount(Base, UUIDMixin, TimestampMixin):
    """Stripe customer mirror for an Org."""

    __tablename__ = "billing_accounts"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    billing_email: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    default_payment_method: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Subscription(Base, UUIDMixin, TimestampMixin):
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tier: Mapped[Tier] = mapped_column(
        Enum(Tier, name="billing_tier"), default=Tier.SOLO, nullable=False
    )
    status: Mapped[SubStatus] = mapped_column(
        Enum(SubStatus, name="sub_status"), default=SubStatus.TRIALING, nullable=False
    )
    seats: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    period_start: Mapped[datetime | None] = mapped_column(nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False, nullable=False)
    annual_billing: Mapped[bool] = mapped_column(default=False, nullable=False)

    org: Mapped[Org] = relationship("Org", back_populates="subscription")


class Invoice(Base, UUIDMixin, TimestampMixin):
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount_eur: Mapped[float] = mapped_column(Float, nullable=False)
    tax_eur: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(nullable=True)
    line_items: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
