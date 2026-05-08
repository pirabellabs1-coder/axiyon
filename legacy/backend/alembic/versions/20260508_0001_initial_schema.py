"""Initial schema — users, orgs, agents, workflows, tasks, audit, memory, billing, integrations.

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-08 03:50:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("locale", sa.String(8), nullable=False, server_default="fr-FR"),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Europe/Paris"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Orgs
    op.create_table(
        "orgs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("domain", sa.String(255)),
        sa.Column("region", sa.String(32), nullable=False, server_default="eu-west-3"),
        sa.Column("settings", JSON, nullable=False, server_default="{}"),
        sa.Column("task_quota_monthly", sa.Integer, nullable=False, server_default="25000"),
        sa.Column("voice_minutes_monthly", sa.Integer, nullable=False, server_default="1000"),
        sa.Column("budget_eur_monthly", sa.Integer, nullable=False, server_default="5000"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Org members
    op.create_table(
        "org_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.Enum("viewer", "operator", "builder", "admin", "owner", name="org_role"), nullable=False, server_default="operator"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "org_id"),
    )

    # Agent templates (catalog)
    op.create_table(
        "agent_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("role", sa.String(128), nullable=False),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("icon", sa.String(8), nullable=False, server_default="🤖"),
        sa.Column("skills", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("default_tools", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("system_prompt", sa.Text, nullable=False),
        sa.Column("price_eur_monthly", sa.Integer, nullable=False, server_default="299"),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Agent instances
    op.create_table(
        "agent_instances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("template_slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("status", sa.Enum("idle", "running", "paused", "error", "archived", name="agent_status"),
                  nullable=False, server_default="idle", index=True),
        sa.Column("config", JSON, nullable=False, server_default="{}"),
        sa.Column("enabled_tools", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("custom_prompt", sa.Text),
        sa.Column("voice_clone_id", sa.String(64)),
        sa.Column("budget_per_day_eur", sa.Integer, nullable=False, server_default="100"),
        sa.Column("health_score", sa.Float, nullable=False, server_default="1.0"),
        sa.Column("tasks_today", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_run_at", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Workflows + runs + steps
    op.create_table(
        "workflows",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("slug", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.Enum("draft", "published", "archived", name="workflow_status"),
                  nullable=False, server_default="draft"),
        sa.Column("spec", JSON, nullable=False),
        sa.Column("schedule_cron", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "slug", "version"),
    )

    op.create_table(
        "workflow_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", UUID(as_uuid=True), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False, index=True),
        sa.Column("status", sa.Enum("pending", "running", "succeeded", "failed", "cancelled", "awaiting_approval",
                                    name="workflow_run_status"), nullable=False, server_default="pending", index=True),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("inputs", JSON, nullable=False, server_default="{}"),
        sa.Column("outputs", JSON, nullable=False, server_default="{}"),
        sa.Column("cost_eur", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("error", sa.Text),
        sa.Column("triggered_by", sa.String(64), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "workflow_steps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("step_index", sa.Integer, nullable=False),
        sa.Column("step_id", sa.String(64), nullable=False),
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("agent_instances.id")),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("input_state", JSON, nullable=False, server_default="{}"),
        sa.Column("output_state", JSON, nullable=False, server_default="{}"),
        sa.Column("tool_calls", JSON, nullable=False, server_default="[]"),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Tasks
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("agent_instances.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("workflow_run_id", UUID(as_uuid=True), sa.ForeignKey("workflow_runs.id")),
        sa.Column("objective", sa.Text, nullable=False),
        sa.Column("status", sa.Enum("queued", "running", "succeeded", "failed", "cancelled", name="task_status"),
                  nullable=False, server_default="queued", index=True),
        sa.Column("input_payload", JSON, nullable=False, server_default="{}"),
        sa.Column("output_payload", JSON, nullable=False, server_default="{}"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("tokens_in", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cost_eur", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("model_used", sa.String(64)),
        sa.Column("error", sa.Text),
        sa.Column("trace_id", sa.String(64), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Audit
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_type", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False, index=True),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("resource_id", sa.String(64)),
        sa.Column("payload", JSON, nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(64)),
        sa.Column("user_agent", sa.Text),
        sa.Column("prev_hash", sa.String(64)),
        sa.Column("record_hash", sa.String(64), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_org_created", "audit_logs", ["org_id", "created_at"])
    op.create_index("ix_audit_actor", "audit_logs", ["actor_type", "actor_id"])

    # Memory
    op.create_table(
        "memory_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("agent_instances.id")),
        sa.Column("kind", sa.Enum("semantic", "episodic", "procedural", "client", "task", name="memory_kind"),
                  nullable=False, server_default="semantic"),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("summary", sa.Text),
        sa.Column("embedding", ARRAY(sa.Float)),
        sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("importance", sa.Float, nullable=False, server_default="0.5"),
        sa.Column("source", sa.String(64)),
        sa.Column("expires_at", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_memory_org_kind", "memory_entries", ["org_id", "kind"])

    op.create_table(
        "knowledge_nodes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_type", sa.String(32), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("properties", JSON, nullable=False, server_default="{}"),
        sa.Column("edges", JSON, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_kg_org_type", "knowledge_nodes", ["org_id", "node_type"])

    # Billing
    op.create_table(
        "billing_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(64), index=True),
        sa.Column("billing_email", sa.String(255), nullable=False),
        sa.Column("tax_id", sa.String(64)),
        sa.Column("address", JSON, nullable=False, server_default="{}"),
        sa.Column("default_payment_method", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("stripe_subscription_id", sa.String(64)),
        sa.Column("tier", sa.Enum("solo", "growth", "enterprise", name="billing_tier"), nullable=False, server_default="solo"),
        sa.Column("status", sa.Enum("trialing", "active", "past_due", "canceled", name="sub_status"),
                  nullable=False, server_default="trialing"),
        sa.Column("seats", sa.Integer, nullable=False, server_default="1"),
        sa.Column("period_start", sa.DateTime(timezone=True)),
        sa.Column("period_end", sa.DateTime(timezone=True)),
        sa.Column("cancel_at_period_end", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("annual_billing", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("number", sa.String(32), unique=True, nullable=False),
        sa.Column("stripe_invoice_id", sa.String(64)),
        sa.Column("amount_eur", sa.Float, nullable=False),
        sa.Column("tax_eur", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("issued_at", sa.DateTime(timezone=True)),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("line_items", JSON, nullable=False, server_default="[]"),
        sa.Column("pdf_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Integrations
    op.create_table(
        "integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("kind", sa.Enum(
            "salesforce", "hubspot", "slack", "stripe", "quickbooks", "notion",
            "linear", "jira", "github", "gmail", "outlook", "zendesk", "intercom",
            "linkedin", "twilio", "sendgrid", "postgres", "snowflake", "custom",
            name="integration_kind"), nullable=False),
        sa.Column("external_account_id", sa.String(128), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("encrypted_token", sa.String(2048), nullable=False),
        sa.Column("refresh_token", sa.String(2048)),
        sa.Column("expires_at", sa.String(32)),
        sa.Column("scopes", JSON, nullable=False, server_default="[]"),
        sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "kind", "external_account_id"),
    )


def downgrade() -> None:
    for tbl in (
        "integrations", "invoices", "subscriptions", "billing_accounts",
        "knowledge_nodes", "memory_entries", "audit_logs", "tasks",
        "workflow_steps", "workflow_runs", "workflows",
        "agent_instances", "agent_templates", "org_members", "orgs", "users",
    ):
        op.drop_table(tbl)
    for enum in (
        "integration_kind", "sub_status", "billing_tier", "memory_kind",
        "task_status", "workflow_run_status", "workflow_status",
        "agent_status", "org_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum}")
