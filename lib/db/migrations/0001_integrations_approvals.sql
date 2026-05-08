-- 0001_integrations_approvals.sql
-- Adds: integrations table (OAuth tokens encrypted) + approvals queue

CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected', 'expired');

CREATE TYPE "integration_status" AS ENUM ('connected', 'expired', 'revoked', 'error');

CREATE TABLE IF NOT EXISTS "integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL,
  "scope" varchar(32),
  "account_id" varchar(256),
  "account_email" varchar(256),
  "account_name" varchar(256),
  "access_token_enc" text NOT NULL,
  "refresh_token_enc" text,
  "expires_at" timestamptz,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" integration_status NOT NULL DEFAULT 'connected',
  "last_used_at" timestamptz,
  "connected_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "integrations_org_provider_account_uq"
  ON "integrations" ("org_id", "provider", "scope", "account_id");

CREATE INDEX IF NOT EXISTS "integrations_org_idx"
  ON "integrations" ("org_id", "status");

CREATE TABLE IF NOT EXISTS "approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agent_instances"("id") ON DELETE CASCADE,
  "task_id" uuid,
  "action_type" varchar(64) NOT NULL,
  "summary" text NOT NULL,
  "payload" jsonb NOT NULL,
  "estimated_impact_eur" double precision DEFAULT 0,
  "status" approval_status NOT NULL DEFAULT 'pending',
  "expires_at" timestamptz,
  "responded_at" timestamptz,
  "responded_by" uuid REFERENCES "users"("id"),
  "response_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "approvals_org_status_idx"
  ON "approvals" ("org_id", "status", "created_at");
