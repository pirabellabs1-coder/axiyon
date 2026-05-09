// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/**
 * GET /api/audit — paginated audit log for the current org.
 *
 * Filterable by ?action= ?actorType= ?since= ?limit= (max 500).
 */
import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { auditLogs, db } from "@/lib/db";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitParam) ? limitParam : 200));
  const action = url.searchParams.get("action");
  const actorType = url.searchParams.get("actorType");
  const sinceStr = url.searchParams.get("since");

  const filters = [eq(auditLogs.orgId, session.user.activeOrgId)];
  if (action) filters.push(eq(auditLogs.action, action));
  if (actorType) filters.push(eq(auditLogs.actorType, actorType));
  if (sinceStr) {
    const d = new Date(sinceStr);
    if (!Number.isNaN(d.getTime())) filters.push(gte(auditLogs.createdAt, d));
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      actorType: auditLogs.actorType,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      payload: auditLogs.payload,
      recordHash: auditLogs.recordHash,
      prevHash: auditLogs.prevHash,
    })
    .from(auditLogs)
    .where(and(...filters))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  // Quick totals (best-effort)
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, session.user.activeOrgId));

  return NextResponse.json({ count: rows.length, total, rows });
}
