/**
 * Drizzle schema for the Axion platform.
 *
 * Tables:
 *   users · orgs · org_members · agent_instances · workflows · workflow_runs
 *   tasks · audit_logs · memory_entries · sessions (auth) · accounts (auth)
 */
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ────────────────────────────────────────────────────────

export const orgRoleEnum = pgEnum("org_role", [
  "viewer",
  "operator",
  "builder",
  "admin",
  "owner",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "idle",
  "running",
  "paused",
  "error",
  "archived",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "published",
  "archived",
]);

export const runStatusEnum = pgEnum("workflow_run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "awaiting_approval",
]);

export const memoryKindEnum = pgEnum("memory_kind", [
  "semantic",
  "episodic",
  "procedural",
  "client",
  "task",
]);

export const tierEnum = pgEnum("billing_tier", ["solo", "growth", "enterprise"]);

// ── Users + auth (Auth.js compatible tables) ─────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  name: varchar("name", { length: 255 }).notNull(),
  image: text("image"),
  passwordHash: text("password_hash"),
  isSuperuser: boolean("is_superuser").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  locale: varchar("locale", { length: 8 }).notNull().default("fr-FR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 128 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 32 }),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

// ── Orgs (tenants) ──────────────────────────────────────────────

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  region: varchar("region", { length: 32 }).notNull().default("eu-west-3"),
  tier: tierEnum("tier").notNull().default("solo"),
  taskQuotaMonthly: integer("task_quota_monthly").notNull().default(1000),
  budgetEurMonthly: integer("budget_eur_monthly").notNull().default(50),
  settings: jsonb("settings").notNull().default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("operator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uq: uniqueIndex("org_members_user_org_uq").on(t.userId, t.orgId) }),
);

// ── Agent instances (no separate template table — catalog lives in code) ──

export const agentInstances = pgTable(
  "agent_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    templateSlug: varchar("template_slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    status: agentStatusEnum("status").notNull().default("idle"),
    config: jsonb("config").notNull().default({}).$type<Record<string, unknown>>(),
    enabledTools: jsonb("enabled_tools")
      .notNull()
      .default([])
      .$type<string[]>(),
    customPrompt: text("custom_prompt"),
    budgetPerDayEur: integer("budget_per_day_eur").notNull().default(10),
    healthScore: doublePrecision("health_score").notNull().default(1.0),
    tasksToday: integer("tasks_today").notNull().default(0),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ orgIdx: index("agent_instances_org_idx").on(t.orgId, t.status) }),
);

// ── Workflows ───────────────────────────────────────────────────

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    status: workflowStatusEnum("status").notNull().default("draft"),
    spec: jsonb("spec").notNull().$type<Record<string, unknown>>(),
    scheduleCron: varchar("schedule_cron", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("workflows_slug_version_uq").on(t.orgId, t.slug, t.version),
    orgIdx: index("workflows_org_idx").on(t.orgId, t.status),
  }),
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    status: runStatusEnum("status").notNull().default("pending"),
    inputs: jsonb("inputs").notNull().default({}).$type<Record<string, unknown>>(),
    outputs: jsonb("outputs").notNull().default({}).$type<Record<string, unknown>>(),
    costEur: doublePrecision("cost_eur").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    triggeredBy: varchar("triggered_by", { length: 64 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ wfIdx: index("workflow_runs_wf_idx").on(t.workflowId, t.status) }),
);

// ── Tasks (atomic billable units) ───────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentInstances.id, { onDelete: "cascade" }),
    workflowRunId: uuid("workflow_run_id"),
    objective: text("objective").notNull(),
    status: taskStatusEnum("status").notNull().default("queued"),
    inputPayload: jsonb("input_payload").notNull().default({}).$type<Record<string, unknown>>(),
    outputPayload: jsonb("output_payload").notNull().default({}).$type<Record<string, unknown>>(),
    toolCalls: jsonb("tool_calls").notNull().default([]).$type<unknown[]>(),
    durationMs: integer("duration_ms"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costEur: doublePrecision("cost_eur").notNull().default(0),
    modelUsed: varchar("model_used", { length: 64 }),
    error: text("error"),
    traceId: varchar("trace_id", { length: 64 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("tasks_org_status_idx").on(t.orgId, t.status, t.createdAt),
    agentIdx: index("tasks_agent_idx").on(t.agentId, t.createdAt),
  }),
);

// ── Audit log (immutable, hash-chained) ─────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    actorType: varchar("actor_type", { length: 16 }).notNull(),
    actorId: varchar("actor_id", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 32 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }),
    payload: jsonb("payload").notNull().default({}).$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    prevHash: varchar("prev_hash", { length: 64 }),
    recordHash: varchar("record_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgCreatedIdx: index("audit_org_created_idx").on(t.orgId, t.createdAt),
    actorIdx: index("audit_actor_idx").on(t.actorType, t.actorId),
  }),
);

// ── Memory ──────────────────────────────────────────────────────

export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id"),
    kind: memoryKindEnum("kind").notNull().default("semantic"),
    content: text("content").notNull(),
    summary: text("summary"),
    // Stored as text for portability; production should add pgvector + ivfflat
    embedding: text("embedding"),
    metadata: jsonb("metadata").notNull().default({}).$type<Record<string, unknown>>(),
    importance: doublePrecision("importance").notNull().default(0.5),
    source: varchar("source", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ orgKindIdx: index("memory_org_kind_idx").on(t.orgId, t.kind) }),
);

// ── Relations ───────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(orgMembers),
}));

export const orgsRelations = relations(orgs, ({ many }) => ({
  members: many(orgMembers),
  agents: many(agentInstances),
  workflows: many(workflows),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
  org: one(orgs, { fields: [orgMembers.orgId], references: [orgs.id] }),
}));

export const agentInstancesRelations = relations(agentInstances, ({ one, many }) => ({
  org: one(orgs, { fields: [agentInstances.orgId], references: [orgs.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  agent: one(agentInstances, { fields: [tasks.agentId], references: [agentInstances.id] }),
  org: one(orgs, { fields: [tasks.orgId], references: [orgs.id] }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  org: one(orgs, { fields: [workflows.orgId], references: [orgs.id] }),
  runs: many(workflowRuns),
}));

// ── Type exports ────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Org = typeof orgs.$inferSelect;
export type OrgMember = typeof orgMembers.$inferSelect;
export type AgentInstance = typeof agentInstances.$inferSelect;
export type NewAgentInstance = typeof agentInstances.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
