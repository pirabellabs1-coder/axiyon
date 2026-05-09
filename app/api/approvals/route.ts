// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/**
 * GET /api/approvals — list current org's pending approvals
 *
 * Filterable:
 *   ?status=pending|approved|rejected|expired (default: pending)
 *   ?limit=50  (max 200)
 */
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { agentInstances, approvals, db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["pending", "approved", "rejected", "expired"] as const);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "pending";
  const status = (ALLOWED_STATUS.has(statusParam as never) ? statusParam : "pending") as
    | "pending"
    | "approved"
    | "rejected"
    | "expired";
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitParam) ? limitParam : 50));

  const rows = await db
    .select({
      id: approvals.id,
      agentId: approvals.agentId,
      agentName: agentInstances.name,
      agentSlug: agentInstances.templateSlug,
      taskId: approvals.taskId,
      actionType: approvals.actionType,
      summary: approvals.summary,
      payload: approvals.payload,
      estimatedImpactEur: approvals.estimatedImpactEur,
      status: approvals.status,
      expiresAt: approvals.expiresAt,
      respondedAt: approvals.respondedAt,
      responseNote: approvals.responseNote,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .leftJoin(agentInstances, eq(agentInstances.id, approvals.agentId))
    .where(and(eq(approvals.orgId, session.user.activeOrgId), eq(approvals.status, status)))
    .orderBy(desc(approvals.createdAt))
    .limit(limit);

  return NextResponse.json(rows);
}
