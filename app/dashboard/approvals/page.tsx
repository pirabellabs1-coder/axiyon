import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { agentInstances, approvals, db } from "@/lib/db";
import { ApprovalsClient } from "./approvals-client";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const rows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.orgId, orgId))
    .orderBy(desc(approvals.createdAt))
    .limit(100);

  // Map agent name lookups
  const agentIds = Array.from(new Set(rows.map((r) => r.agentId).filter(Boolean) as string[]));
  let agentMap: Record<string, { name: string; templateSlug: string }> = {};
  if (agentIds.length) {
    const ags = await db
      .select({
        id: agentInstances.id,
        name: agentInstances.name,
        templateSlug: agentInstances.templateSlug,
      })
      .from(agentInstances)
      .where(and(eq(agentInstances.orgId, orgId)));
    agentMap = Object.fromEntries(
      ags.map((a) => [a.id, { name: a.name, templateSlug: a.templateSlug }]),
    );
  }

  return (
    <ApprovalsClient
      items={rows.map((r) => ({
        id: r.id,
        agentName: r.agentId ? agentMap[r.agentId]?.name ?? null : null,
        agentTemplate: r.agentId ? agentMap[r.agentId]?.templateSlug ?? null : null,
        actionType: r.actionType,
        summary: r.summary,
        payload: r.payload,
        estimatedImpactEur: r.estimatedImpactEur ?? 0,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString?.() ?? null,
      }))}
    />
  );
}
