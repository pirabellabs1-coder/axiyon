// Live activity feed for the org — recent tasks + audit events + approvals.
// Polled by /dashboard's LiveActivity client component every 5s.
import { auth } from "@/auth";

export const runtime = "edge";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.activeOrgId;

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 3600_000);
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "20"));

  const [{ desc, eq, gte, and, sql }, { db, tasks, agentInstances, auditLogs }] =
    await Promise.all([import("drizzle-orm"), import("@/lib/db")]);

  const [recentTasks, recentAudit] = await Promise.all([
    db
      .select({
        id: tasks.id,
        agentId: tasks.agentId,
        agentName: agentInstances.name,
        agentSlug: agentInstances.templateSlug,
        objective: tasks.objective,
        status: tasks.status,
        durationMs: tasks.durationMs,
        costEur: tasks.costEur,
        modelUsed: tasks.modelUsed,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .leftJoin(agentInstances, eq(agentInstances.id, tasks.agentId))
      .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, since)))
      .orderBy(desc(tasks.createdAt))
      .limit(limit),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorType: auditLogs.actorType,
        actorId: auditLogs.actorId,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        payload: auditLogs.payload,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, since)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit),
  ]);

  // Build a unified event stream sorted by createdAt desc.
  type FeedItem = {
    id: string;
    kind: "task" | "audit";
    at: string;
    text: string;
    agent?: { name: string; slug: string };
    status?: string;
  };

  const items: FeedItem[] = [];
  for (const t of recentTasks) {
    items.push({
      id: `t:${t.id}`,
      kind: "task",
      at: t.createdAt.toISOString(),
      text: t.objective.slice(0, 200),
      agent: t.agentName
        ? { name: t.agentName, slug: t.agentSlug ?? "" }
        : undefined,
      status: t.status,
    });
  }
  for (const a of recentAudit) {
    // Skip audit entries that are duplicates of task creation.
    if (a.action === "agent.run.completed") continue;
    const summary = summarizeAudit(a.action, a.payload as Record<string, unknown> | null);
    if (!summary) continue;
    items.push({
      id: `a:${a.id}`,
      kind: "audit",
      at: a.createdAt.toISOString(),
      text: summary,
    });
  }
  items.sort((x, y) => y.at.localeCompare(x.at));

  return Response.json({
    serverTime: new Date().toISOString(),
    items: items.slice(0, limit),
  });
}

function summarizeAudit(
  action: string,
  payload: Record<string, unknown> | null,
): string | null {
  const p = payload ?? {};
  switch (action) {
    case "agent.handoff":
      return `Handoff vers ${String(p.to_agent ?? "agent")} : ${String(p.action ?? "").slice(0, 120)}`;
    case "agent.hire":
      return `Agent ${String(p.name ?? "")} recruté (${String(p.template ?? "")})`;
    case "approval.requested":
      return `Approbation demandée : ${String(p.summary ?? p.actionType ?? "action")}`;
    case "approval.approved":
      return `Approbation accordée : ${String(p.actionType ?? "action")}`;
    case "approval.rejected":
      return `Approbation refusée : ${String(p.actionType ?? "action")}`;
    case "integration.connect":
      return `Intégration ${String(p.provider ?? "")} connectée`;
    case "integration.disconnect":
      return `Intégration ${String(p.provider ?? "")} déconnectée`;
    case "user.signup":
      return `Compte créé`;
    case "password.reset":
      return `Mot de passe modifié`;
    default:
      return null;
  }
}
