import { redirect } from "next/navigation";
import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import { auth } from "@/auth";
import { agentInstances, approvals, db, orgs, tasks } from "@/lib/db";
import { ChatView } from "./chat-view";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [allAgents, [orgRow], [costRow], [tasksRow], [pendingRow]] = await Promise.all([
    db
      .select({
        id: agentInstances.id,
        name: agentInstances.name,
        templateSlug: agentInstances.templateSlug,
        status: agentInstances.status,
        enabledTools: agentInstances.enabledTools,
        customPrompt: agentInstances.customPrompt,
      })
      .from(agentInstances)
      .where(eq(agentInstances.orgId, orgId))
      .orderBy(sql`${agentInstances.createdAt} DESC`),
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1),
    db
      .select({ cost: sum(tasks.costEur).mapWith(Number) })
      .from(tasks)
      .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, monthStart))),
    db
      .select({ n: count(tasks.id) })
      .from(tasks)
      .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, monthStart))),
    db
      .select({ n: count(approvals.id) })
      .from(approvals)
      .where(and(eq(approvals.orgId, orgId), eq(approvals.status, "pending"))),
  ]);

  return (
    <ChatView
      userName={session.user.name ?? "Vous"}
      agents={allAgents.map((a) => ({
        id: a.id,
        name: a.name,
        templateSlug: a.templateSlug,
        status: a.status,
        enabledTools: (a.enabledTools as string[] | null) ?? [],
        systemPrompt: a.customPrompt ?? undefined,
      }))}
      orgStats={{
        budgetUsedEur: Number(costRow?.cost ?? 0),
        budgetLimitEur: Number(orgRow?.budgetEurMonthly ?? 50),
        tasksUsed: Number(tasksRow?.n ?? 0),
        tasksLimit: Number(orgRow?.taskQuotaMonthly ?? 1000),
        pendingApprovals: Number(pendingRow?.n ?? 0),
      }}
    />
  );
}
