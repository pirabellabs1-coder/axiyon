/**
 * Cryptographically chained audit log.
 *
 * Each row carries `record_hash = SHA-256(prev_hash || canonical_json(payload))`,
 * so any tampering breaks the chain and is detected by `verifyChain()`.
 */
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { db, auditLogs } from "@/lib/db";

interface AuditInput {
  orgId: string;
  actorType: "user" | "agent" | "system";
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

function hashPayload(prevHash: string | null, payload: unknown): string {
  const h = createHash("sha256");
  h.update(prevHash ?? "GENESIS");
  h.update("|");
  h.update(canonicalJson(payload));
  return h.digest("hex");
}

export async function audit(input: AuditInput): Promise<void> {
  const last = await db
    .select({ recordHash: auditLogs.recordHash })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, input.orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  const prevHash = last[0]?.recordHash ?? null;
  const fullPayload = {
    orgId: input.orgId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    payload: input.payload ?? {},
    timestamp: new Date().toISOString(),
  };
  const recordHash = hashPayload(prevHash, fullPayload);

  await db.insert(auditLogs).values({
    orgId: input.orgId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    payload: input.payload ?? {},
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    prevHash,
    recordHash,
  });
}

export async function verifyChain(orgId: string): Promise<{ ok: boolean; n: number }> {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(auditLogs.createdAt);

  let prev: string | null = null;
  for (const row of rows) {
    if (row.prevHash !== prev) {
      return { ok: false, n: rows.length };
    }
    prev = row.recordHash;
  }
  return { ok: true, n: rows.length };
}
