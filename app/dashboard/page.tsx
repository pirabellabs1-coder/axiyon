import Link from "next/link";
import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

import {
  agentInstances,
  db,
  orgs,
  tasks,
  type AgentInstance,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { TEMPLATES, getTemplate } from "@/lib/agents/catalog";
import { formatEur, formatNumber, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  const agents: AgentInstance[] = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`)
    .limit(8);

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const [{ totalTasks, totalCost, avgDuration }] = await db
    .select({
      totalTasks: count(tasks.id),
      totalCost: sum(tasks.costEur).mapWith(Number),
      avgDuration: sql<number>`avg(${tasks.durationMs})`.mapWith(Number),
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, periodStart)));

  const recent = await db
    .select()
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
    .orderBy(sql`${tasks.createdAt} DESC`)
    .limit(8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">
          Bonjour, {session.user.name ?? session.user.email} 👋
        </h1>
        <p className="text-ink-2 mt-1">
          {org?.name} · plan {org?.tier} · {formatNumber(org?.taskQuotaMonthly ?? 0)} tâches/mois inclus
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Agents actifs" value={String(agents.filter((a) => a.status !== "archived").length)} />
        <KPI label="Tâches ce mois" value={formatNumber(totalTasks ?? 0)} />
        <KPI label="Coût ce mois" value={formatEur(totalCost ?? 0)} />
        <KPI
          label="Durée moy."
          value={avgDuration ? `${(avgDuration / 1000).toFixed(1)} s` : "—"}
        />
      </div>

      {/* Empty state vs. agents grid */}
      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <div className="text-5xl">🚀</div>
            <CardTitle>Recrutez votre premier agent</CardTitle>
            <CardDescription>
              Iris, Atlas, Sage, Codex, Nova, Forge, Lumen, Quill — choisissez parmi {TEMPLATES.length}{" "}
              agents prêts à travailler.
            </CardDescription>
            <Button asChild variant="glow">
              <Link href="/dashboard/agents/hire">Recruter un agent →</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Vos agents</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/agents">Voir tous →</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => {
              const t = getTemplate(a.templateSlug);
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/agents/${a.id}`}
                  className="card hover:border-brand-blue transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-md bg-bg-3 border border-line flex items-center justify-center text-lg">
                      {t?.icon ?? "🤖"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-ink-2">{t?.role ?? a.templateSlug}</div>
                    </div>
                    <span
                      className={
                        a.status === "running"
                          ? "status-dot bg-brand-blue shadow-[0_0_8px_#5B6CFF]"
                          : a.status === "error"
                            ? "status-dot bg-brand-red shadow-[0_0_8px_#F87171]"
                            : a.status === "paused"
                              ? "status-dot bg-ink-3"
                              : "status-dot bg-brand-green shadow-[0_0_8px_#34D399]"
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-line text-xs text-ink-3 font-mono">
                    <span>{formatNumber(a.tasksToday)} tâches/jour</span>
                    <span>Health {Math.round((a.healthScore ?? 1) * 100)}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Activité récente</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/tasks">Toutes les tâches →</Link>
            </Button>
          </div>
          <Card>
            <ul className="divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                  <span
                    className={
                      "status-dot " +
                      (t.status === "succeeded"
                        ? "bg-brand-green"
                        : t.status === "failed"
                          ? "bg-brand-red"
                          : t.status === "running"
                            ? "bg-brand-blue animate-pulse"
                            : "bg-ink-3")
                    }
                  />
                  <span className="flex-1 truncate text-ink-2">{t.objective}</span>
                  <span className="text-ink-3 font-mono text-xs">
                    {formatEur(t.costEur ?? 0)}
                  </span>
                  <span className="text-ink-3 text-xs">{relativeTime(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs text-ink-2 mb-1">{label}</div>
        <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
