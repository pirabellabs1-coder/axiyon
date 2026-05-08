-- Axion · initial schema (Postgres 16 + pgvector optional).
-- Apply with `pnpm db:migrate` or paste into Vercel Postgres SQL console.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Optional: pgvector for production-grade vector recall.
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- ── Enums ──────────────────────────────────────────────────────
CREATE TYPE "org_role" AS ENUM ('viewer', 'operator', 'builder', 'admin', 'owner');
CREATE TYPE "agent_status" AS ENUM ('idle', 'running', 'paused', 'error', 'archived');
CREATE TYPE "task_status" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE "workflow_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "workflow_run_status" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'awaiting_approval');
CREATE TYPE "memory_kind" AS ENUM ('semantic', 'episodic', 'procedural', 'client', 'task');
CREATE TYPE "billing_tier" AS ENUM ('solo', 'growth', 'enterprise');

-- ── Users + auth ───────────────────────────────────────────────
CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "emailVerified" TIMESTAMP,
  "name" VARCHAR(255) NOT NULL,
  "image" TEXT,
  "password_hash" TEXT,
  "is_superuser" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "locale" VARCHAR(8) NOT NULL DEFAULT 'fr-FR',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "users" ("email");

CREATE TABLE "accounts" (
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(32) NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "providerAccountId" VARCHAR(128) NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" VARCHAR(32),
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  PRIMARY KEY ("provider", "providerAccountId")
);

CREATE TABLE "sessions" (
  "sessionToken" TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires" TIMESTAMP NOT NULL
);

CREATE TABLE "verificationTokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

-- ── Orgs ───────────────────────────────────────────────────────
CREATE TABLE "orgs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(64) NOT NULL UNIQUE,
  "domain" VARCHAR(255),
  "region" VARCHAR(32) NOT NULL DEFAULT 'eu-west-3',
  "tier" "billing_tier" NOT NULL DEFAULT 'solo',
  "task_quota_monthly" INTEGER NOT NULL DEFAULT 1000,
  "budget_eur_monthly" INTEGER NOT NULL DEFAULT 50,
  "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "org_members" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "org_id" UUID NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "role" "org_role" NOT NULL DEFAULT 'operator',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "org_members_user_org_uq" ON "org_members" ("user_id", "org_id");

-- ── Agent instances ────────────────────────────────────────────
CREATE TABLE "agent_instances" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "org_id" UUID NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "template_slug" VARCHAR(64) NOT NULL,
  "name" VARCHAR(64) NOT NULL,
  "status" "agent_status" NOT NULL DEFAULT 'idle',
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "enabled_tools" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "custom_prompt" TEXT,
  "budget_per_day_eur" INTEGER NOT NULL DEFAULT 10,
  "health_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "tasks_today" INTEGER NOT NULL DEFAULT 0,
  "last_run_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "agent_instances_org_idx" ON "agent_instances" ("org_id", "status");

-- ── Workflows ──────────────────────────────────────────────────
CREATE TABLE "workflows" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "org_id" UUID NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "slug" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "workflow_status" NOT NULL DEFAULT 'draft',
  "spec" JSONB NOT NULL,
  "schedule_cron" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "workflows_slug_version_uq" ON "workflows" ("org_id", "slug", "version");
CREATE INDEX "workflows_org_idx" ON "workflows" ("org_id", "status");

CREATE TABLE "workflow_runs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workflow_id" UUID NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "org_id" UUID NOT NULL,
  "status" "workflow_run_status" NOT NULL DEFAULT 'pending',
  "inputs" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "outputs" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "cost_eur" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "error" TEXT,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "triggered_by" VARCHAR(64) NOT NULL DEFAULT 'manual',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "workflow_runs_wf_idx" ON "workflow_runs" ("workflow_id", "status");

-- ── Tasks ──────────────────────────────────────────────────────
CREATE TABLE "tasks" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "org_id" UUID NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "agent_id" UUID NOT NULL REFERENCES "agent_instances"("id") ON DELETE CASCADE,
  "workflow_run_id" UUID,
  "objective" TEXT NOT NULL,
  "status" "task_status" NOT NULL DEFAULT 'queued',
  "input_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "output_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tool_calls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "duration_ms" INTEGER,
  "tokens_in" INTEGER NOT NULL DEFAULT 0,
  "tokens_out" INTEGER NOT NULL DEFAULT 0,
  "cost_eur" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "model_used" VARCHAR(64),
  "error" TEXT,
  "trace_id" VARCHAR(64),
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "tasks_org_status_idx" ON "tasks" ("org_id", "status", "created_at");
CREATE INDEX "tasks_agent_idx" ON "tasks" ("agent_id", "created_at");

-- ── Audit logs ─────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "org_id" UUID NOT NULL,
  "actor_type" VARCHAR(16) NOT NULL,
  "actor_id" VARCHAR(64) NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "resource_type" VARCHAR(32) NOT NULL,
  "resource_id" VARCHAR(64),
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ip_address" VARCHAR(64),
  "user_agent" TEXT,
  "prev_hash" VARCHAR(64),
  "record_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "audit_org_created_idx" ON "audit_logs" ("org_id", "created_at");
CREATE INDEX "audit_actor_idx" ON "audit_logs" ("actor_type", "actor_id");

-- ── Memory ─────────────────────────────────────────────────────
CREATE TABLE "memory_entries" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "org_id" UUID NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "agent_id" UUID,
  "kind" "memory_kind" NOT NULL DEFAULT 'semantic',
  "content" TEXT NOT NULL,
  "summary" TEXT,
  "embedding" TEXT,                          -- JSON-stringified vector for portability
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "source" VARCHAR(64),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "memory_org_kind_idx" ON "memory_entries" ("org_id", "kind");
