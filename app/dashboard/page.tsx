import Link from "next/link";
import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  Plus,
  Sparkles,
  Activity,
  AlertCircle,
  Pause,
  ArrowRight,
  Users,
  Coins,
  Clock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

import { auth } from "@/auth";
import {
  agentInstances,
  approvals,
  auditLogs,
  db,
  orgs,
  tasks,
  type AgentInstance,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { TEMPLATES, getTemplate } from "@/lib/agents/catalog";
import { formatEur, formatNumber } from "@/lib/utils";
import { AgentIcon } from "@/components/agent-icon";
import { LiveActivity, type FeedItem } from "@/components/live-activity";

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

  const [{ totalAgents }] = await db
    .select({ totalAgents: count(agentInstances.id) })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId));

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const yesterday = new Date(Date.now() - 24 * 3600_000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000);

  const [{ totalTasks, totalCost, avgDuration }] = await db
    .select({
      totalTasks: count(tasks.id),
      totalCost: sum(tasks.costEur).mapWith(Number),
      avgDuration: sql<number>`avg(${tasks.durationMs})`.mapWith(Number),
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, periodStart)));

  const [{ tasks24h }] = await db
    .select({ tasks24h: count(tasks.id) })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, yesterday)));

  const [{ pendingApprovals }] = await db
    .select({ pendingApprovals: count(approvals.id) })
    .from(approvals)
    .where(and(eq(approvals.orgId, orgId), eq(approvals.status, "pending")));

  // Top agents by activity over the last 30 days (number of tasks delivered).
  const topAgents = await db
    .select({
      agentId: tasks.agentId,
      cost: sum(tasks.costEur).mapWith(Number),
      n: count(tasks.id),
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, thirtyDaysAgo)))
    .groupBy(tasks.agentId)
    .orderBy(desc(count(tasks.id)))
    .limit(5);

  // Tasks per hour for the last 24h
  const tasksByHour = await db
    .select({
      hour: sql<string>`date_trunc('hour', ${tasks.createdAt})`.as("h"),
      n: count(tasks.id),
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, yesterday)))
    .groupBy(sql`date_trunc('hour', ${tasks.createdAt})`)
    .orderBy(sql`date_trunc('hour', ${tasks.createdAt})`);

  // Build hour buckets (24h)
  const buckets: number[] = Array.from({ length: 24 }, () => 0);
  for (const row of tasksByHour) {
    const d = new Date(row.hour);
    const idx = Math.floor((d.getTime() - yesterday.getTime()) / 3600_000);
    if (idx >= 0 && idx < 24) buckets[idx] = row.n;
  }
  const maxBucket = Math.max(1, ...buckets);

  const recent = await db
    .select({
      id: tasks.id,
      agentId: tasks.agentId,
      agentName: agentInstances.name,
      agentSlug: agentInstances.templateSlug,
      objective: tasks.objective,
      status: tasks.status,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(agentInstances, eq(agentInstances.id, tasks.agentId))
    .where(eq(tasks.orgId, orgId))
    .orderBy(sql`${tasks.createdAt} DESC`)
    .limit(8);

  const recentAudit = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(sql`${auditLogs.createdAt} DESC`)
    .limit(8);

  // Build the initial unified feed items (server-rendered for SEO/no-JS),
  // then the LiveActivity client component takes over polling.
  const taskItems: FeedItem[] = recent.map((t) => ({
    id: `t:${t.id}`,
    kind: "task",
    at: t.createdAt.toISOString(),
    text: t.objective.slice(0, 200),
    agent: t.agentName ? { name: t.agentName, slug: t.agentSlug ?? "" } : undefined,
    status: t.status,
  }));

  const auditItems: FeedItem[] = [];
  for (const a of recentAudit) {
    const p = (a.payload as Record<string, unknown>) ?? {};
    let summary: string | null = null;
    switch (a.action) {
      case "agent.handoff":
        summary = `Handoff vers ${String(p.to_agent ?? "agent")} : ${String(p.action ?? "").slice(0, 120)}`;
        break;
      case "approval.requested":
        summary = `Approbation demandée : ${String(p.summary ?? p.actionType ?? "action")}`;
        break;
      case "approval.approved":
        summary = `Approbation accordée : ${String(p.actionType ?? "action")}`;
        break;
      case "integration.connect":
        summary = `Intégration ${String(p.provider ?? "")} connectée`;
        break;
    }
    if (summary) {
      auditItems.push({
        id: `a:${a.id}`,
        kind: "audit",
        at: a.createdAt.toISOString(),
        text: summary,
      });
    }
  }

  const initialFeed: FeedItem[] = [...taskItems, ...auditItems]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  const agentsById = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            Bonjour, {(session.user.name ?? session.user.email ?? "vous").split(" ")[0]} 👋
          </h1>
          <p className="text-ink-2 mt-1.5">
            {totalAgents > 0
              ? `Voici ce que vos ${formatNumber(totalAgents)} agent${totalAgents > 1 ? "s" : ""} ont fait pendant que vous dormiez.`
              : "Recrutez votre premier agent pour démarrer."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/integrations">
              <Plus className="size-4" /> Connecter un outil
            </Link>
          </Button>
          <Button asChild variant="glow" size="sm">
            <Link href="/dashboard/agents/hire">
              <Sparkles className="size-4" /> Recruter un agent
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI grid — uses the demo's `.kpi` / `.kpi-grid` classes verbatim. */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Tâches accomplies (24h)</div>
          <div className="kpi-value">{formatNumber(tasks24h ?? 0)}</div>
          <div className={`kpi-trend ${tasks24h && tasks24h > 0 ? "up" : ""}`}>
            {tasks24h ? `▲ +${tasks24h} aujourd'hui` : "Aucune tâche aujourd'hui"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Durée moyenne</div>
          <div className="kpi-value">{avgDuration ? `${(avgDuration / 1000).toFixed(1)} s` : "—"}</div>
          <div className="kpi-trend">par tâche</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Coût Axion (ce mois)</div>
          <div className="kpi-value">{formatEur(totalCost ?? 0)}</div>
          <div className="kpi-trend">{formatNumber(totalTasks ?? 0)} tâches au total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Approbations en attente</div>
          <div className="kpi-value">{formatNumber(pendingApprovals ?? 0)}</div>
          <div className={`kpi-trend ${pendingApprovals && pendingApprovals > 0 ? "down" : "up"}`}>
            {pendingApprovals && pendingApprovals > 0 ? "→ action requise" : "aucune en attente"}
          </div>
        </div>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <div className="size-14 rounded-xl bg-grad shadow-glow mx-auto flex items-center justify-center">
              <Sparkles className="size-7 text-white" strokeWidth={1.6} />
            </div>
            <CardTitle>Recrutez votre premier agent</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Iris, Atlas, Sage, Codex, Nova, Forge… choisissez parmi {TEMPLATES.length}+
              agents prêts à travailler dans votre organisation.
            </CardDescription>
            <Button asChild variant="glow">
              <Link href="/dashboard/agents/hire">
                <Plus className="size-4" /> Recruter un agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* dash-grid — same class names as the demo */}
          <div className="dash-grid">
            <div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Activité agents · 24h</div>
                    <div className="panel-meta">Tâches/heure · UTC+1</div>
                  </div>
                  <div className="panel-meta">max {maxBucket}</div>
                </div>
                <div className="chart">
                  {buckets.map((v, i) => (
                    <div
                      key={i}
                      className="chart-bar"
                      style={{ height: `${Math.max(4, (v / maxBucket) * 100)}%` }}
                      title={`${v} tâches il y a ${24 - i}h`}
                    />
                  ))}
                </div>
                <div className="chart-axis">
                  <span>00h</span>
                  <span>06h</span>
                  <span>12h</span>
                  <span>18h</span>
                  <span>maintenant</span>
                </div>
              </div>

              {topAgents.length > 0 && (
                <div className="panel">
                  <div className="panel-head">
                    <div className="panel-title">Top agents par valeur générée (30j)</div>
                  </div>
                  <div className="space-y-0">
                    {topAgents.map((row) => {
                      const a = agentsById[row.agentId];
                      const tpl = a ? getTemplate(a.templateSlug) : null;
                      return (
                        <Link
                          key={row.agentId}
                          href={`/dashboard/agents/${row.agentId}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-bg-3/40 rounded-md px-2 -mx-2 transition-colors"
                        >
                          <AgentIcon
                            name={tpl?.icon ?? "Bot"}
                            wrapperClassName="size-10"
                            size={16}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              <span className="text-brand-blue-2">{a?.name ?? "Agent"}</span>
                              {tpl?.role ? (
                                <span className="text-ink-2"> · {tpl.role}</span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-ink-3 font-mono mt-0.5">
                              {formatNumber(row.n)} tâche{row.n > 1 ? "s" : ""} livrée{row.n > 1 ? "s" : ""} · {formatEur(Number(row.cost ?? 0))}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] text-brand-green font-mono inline-flex items-center gap-1">
                              <TrendingUp className="size-3" />
                              actif
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live activity feed — uses .panel + .feed classes from the demo */}
            <div>
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title">Activité en direct</div>
                  <div className="panel-meta flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-brand-green shadow-[0_0_8px_#34D399]" />
                    LIVE
                  </div>
                </div>
                <LiveActivity initial={initialFeed} />
              </div>
            </div>
          </div>

          {/* Agents grid */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Vos agents</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/agents">
                  Voir tous <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((a) => {
                const tpl = getTemplate(a.templateSlug);
                const StatusIcon =
                  a.status === "running"
                    ? Activity
                    : a.status === "error"
                      ? AlertCircle
                      : a.status === "paused"
                        ? Pause
                        : Activity;
                const statusColor =
                  a.status === "running"
                    ? "text-brand-blue"
                    : a.status === "error"
                      ? "text-brand-red"
                      : a.status === "paused"
                        ? "text-ink-3"
                        : "text-brand-green";
                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/agents/${a.id}`}
                    className="card hover:border-brand-blue transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <AgentIcon name={tpl?.icon ?? "Bot"} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium leading-tight">{a.name}</div>
                        <div className="text-xs text-ink-2 mt-0.5">
                          {tpl?.role ?? a.templateSlug}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-mono ${statusColor}`}
                      >
                        <StatusIcon className="size-3" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-line text-xs text-ink-3 font-mono tabular-nums">
                      <span>{formatNumber(a.tasksToday)} tâches/jour</span>
                      <span>Santé {Math.round((a.healthScore ?? 1) * 100)}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  trend,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href?: string;
}) {
  const inner = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-xs text-ink-2">{label}</div>
        <Icon className={`size-4 ${accent}`} />
      </div>
      <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      <div className={`text-[10px] mt-1 font-mono ${accent}`}>{trend}</div>
    </CardContent>
  );
  if (href) {
    return (
      <Link href={href}>
        <Card className="hover:border-brand-blue transition-colors cursor-pointer">
          {inner}
        </Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}
