import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { agentInstances, db, tasks } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { getTemplate } from "@/lib/agents/catalog";
import { formatEur, relativeTime } from "@/lib/utils";
import { AgentIcon } from "@/components/agent-icon";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  const rows = await db
    .select({
      task: tasks,
      agent: agentInstances,
    })
    .from(tasks)
    .leftJoin(agentInstances, eq(tasks.agentId, agentInstances.id))
    .where(eq(tasks.orgId, session.user.activeOrgId))
    .orderBy(sql`${tasks.createdAt} DESC`)
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Toutes les tâches</h1>
        <p className="text-ink-2 mt-1">200 dernières exécutions, tous agents confondus.</p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-ink-2">Aucune tâche encore.</div>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                {["Statut", "Agent", "Objectif", "Modèle", "Tokens", "Coût", "Durée", "Quand"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-4 py-3"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ task, agent }) => {
                const t = agent ? getTemplate(agent.templateSlug) : undefined;
                return (
                  <tr key={task.id} className="border-b border-line last:border-0 hover:bg-bg-3">
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 text-[11px] font-mono " +
                          (task.status === "succeeded"
                            ? "text-brand-green"
                            : task.status === "failed"
                              ? "text-brand-red"
                              : task.status === "running"
                                ? "text-brand-blue"
                                : "text-ink-3")
                        }
                      >
                        <span className="size-1.5 rounded-full bg-current inline-block" />
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <AgentIcon name={t?.icon ?? "Bot"} wrapperClassName="size-7" size={13} />
                        <span>{agent?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-md truncate">{task.objective}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-3">
                      {task.modelUsed ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {task.tokensIn + task.tokensOut}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {formatEur(task.costEur ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-ink-3">
                      {relativeTime(task.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
