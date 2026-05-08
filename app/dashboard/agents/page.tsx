import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTemplate } from "@/lib/agents/catalog";
import { formatNumber, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const agents = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  if (agents.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-medium tracking-tight">Vos agents</h1>
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <div className="text-5xl">🤖</div>
            <p className="text-ink-2">Aucun agent recruté pour l'instant.</p>
            <Button asChild variant="glow">
              <Link href="/dashboard/agents/hire">Recruter mon premier agent →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Vos agents</h1>
          <p className="text-ink-2 mt-1">
            {formatNumber(agents.length)} agents · {agents.filter((a) => a.status === "running").length} en cours
          </p>
        </div>
        <Button asChild variant="glow">
          <Link href="/dashboard/agents/hire">Recruter +</Link>
        </Button>
      </div>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3 w-10" />
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">
                Agent
              </th>
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">
                Statut
              </th>
              <th className="text-right text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">
                Tâches/jour
              </th>
              <th className="text-right text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">
                Health
              </th>
              <th className="text-right text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">
                Budget €/jour
              </th>
              <th className="text-right text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">
                Dernier run
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const t = getTemplate(a.templateSlug);
              return (
                <tr
                  key={a.id}
                  className="border-b border-line last:border-0 hover:bg-bg-3 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/agents/${a.id}`} className="size-8 rounded-md bg-bg-3 border border-line flex items-center justify-center text-base">
                      {t?.icon ?? "🤖"}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/agents/${a.id}`} className="block">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-ink-2">{t?.role ?? a.templateSlug}</div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        "text-xs font-mono " +
                        (a.status === "running"
                          ? "text-brand-blue"
                          : a.status === "error"
                            ? "text-brand-red"
                            : a.status === "paused"
                              ? "text-ink-3"
                              : "text-brand-green")
                      }
                    >
                      ● {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-sm">{a.tasksToday}</td>
                  <td className="px-5 py-3 text-right font-mono text-sm">
                    {Math.round((a.healthScore ?? 1) * 100)}%
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-sm">{a.budgetPerDayEur}</td>
                  <td className="px-5 py-3 text-right text-xs text-ink-3">
                    {relativeTime(a.lastRunAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
