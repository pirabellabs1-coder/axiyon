"""Third-party integrations (OAuth tokens, API creds) per Org."""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import JSON, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from axion.db.base import Base, TimestampMixin, UUIDMixin


class IntegrationKind(str, enum.Enum):
    SALESFORCE = "salesforce"
    HUBSPOT = "hubspot"
    SLACK = "slack"
    STRIPE = "stripe"
    QUICKBOOKS = "quickbooks"
    NOTION = "notion"
    LINEAR = "linear"
    JIRA = "jira"
    GITHUB = "github"
    GMAIL = "gmail"
    OUTLOOK = "outlook"
    ZENDESK = "zendesk"
    INTERCOM = "intercom"
    LINKEDIN = "linkedin"
    TWILIO = "twilio"
    SENDGRID = "sendgrid"
    POSTGRES = "postgres"
    SNOWFLAKE = "snowflake"
    CUSTOM = "custom"


class Integration(Base, UUIDMixin, TimestampMixin):
    """A connected third-party tool. Tokens encrypted at rest (envelope KMS)."""

    __table_args__ = (UniqueConstraint("org_id", "kind", "external_account_id"),)

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[IntegrationKind] = mapped_column(
        Enum(IntegrationKind, name="integration_kind"), nullable=False
    )
    external_account_id: Mapped[str] = mapped_column(String(128), nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_token: Mapped[str] = mapped_column(String(2048), nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    expires_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    scopes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
