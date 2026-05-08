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
  db,
  orgs,
  tasks,
  type AgentInstance,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { TEMPLATES, getTemplate } from "@/lib/agents/catalog";
import { formatEur, formatNumber, relativeTime } from "@/lib/utils";
import { AgentIcon } from "@/components/agent-icon";

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

  const yesterday = new Date(Date.now() - 24 * 3600_000);

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

  // Top spending agents
  const topAgents = await db
    .select({
      agentId: tasks.agentId,
      cost: sum(tasks.costEur).mapWith(Number),
      n: count(tasks.id),
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, periodStart)))
    .groupBy(tasks.agentId)
    .orderBy(desc(sql`coalesce(sum(${tasks.costEur}),0)`))
    .limit(4);

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
    .select()
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
    .orderBy(sql`${tasks.createdAt} DESC`)
    .limit(8);

  const agentsById = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            Bonjour, {session.user.name ?? session.user.email}
          </h1>
          <p className="text-ink-2 mt-1.5">
            {org?.name} · plan {org?.tier} · {formatNumber(org?.taskQuotaMonthly ?? 0)} tâches/mois inclus
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

      {/* Top KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Tâches (24 h)"
          value={formatNumber(tasks24h ?? 0)}
          trend={tasks24h ? `+${tasks24h} aujourd'hui` : "Aucune tâche aujourd'hui"}
          icon={CheckCircle2}
          accent="text-brand-green"
        />
        <Kpi
          label="Coût IA · ce mois"
          value={formatEur(totalCost ?? 0)}
          trend={`${formatNumber(totalTasks ?? 0)} tâches au total`}
          icon={Coins}
          accent="text-brand-cyan"
        />
        <Kpi
          label="Durée moyenne"
          value={avgDuration ? `${(avgDuration / 1000).toFixed(1)} s` : "—"}
          trend="par tâche"
          icon={Clock}
          accent="text-brand-magenta"
        />
        <Kpi
          label="Approbations"
          value={formatNumber(pendingApprovals ?? 0)}
          trend={pendingApprovals && pendingApprovals > 0 ? "Action requise" : "Aucune en attente"}
          icon={AlertCircle}
          accent={
            pendingApprovals && pendingApprovals > 0
              ? "text-brand-yellow"
              : "text-brand-green"
          }
          href={pendingApprovals && pendingApprovals > 0 ? "/dashboard/approvals" : undefined}
        />
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
          {/* 2-column layout: chart+top / activity feed */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
            {/* Activity chart */}
            <div className="space-y-3">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">Activité agents · 24 h</h3>
                      <p className="text-xs text-ink-3 font-mono mt-0.5">
                        Tâches par heure
                      </p>
                    </div>
                    <span className="text-xs text-ink-3 font-mono">
                      max {maxBucket}
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-32">
                    {buckets.map((v, i) => {
                      const heightPct = (v / maxBucket) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-grad rounded-sm relative group hover:opacity-80 transition-opacity"
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                          title={`${v} tâches il y a ${24 - i}h`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-3 font-mono">
                    <span>−24 h</span>
                    <span>−12 h</span>
                    <span>maintenant</span>
                  </div>
                </CardContent>
              </Card>

              {topAgents.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-medium text-sm">
                      Top agents par coût · ce mois
                    </h3>
                    <div className="space-y-2">
                      {topAgents.map((row) => {
                        const a = agentsById[row.agentId];
                        const tpl = a ? getTemplate(a.templateSlug) : null;
                        return (
                          <Link
                            key={row.agentId}
                            href={`/dashboard/agents/${row.agentId}`}
                            className="flex items-center gap-3 py-2 hover:bg-bg-3/40 rounded-md px-2 -mx-2 transition-colors"
                          >
                            <AgentIcon
                              name={tpl?.icon ?? "Bot"}
                              wrapperClassName="size-9"
                              size={14}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {a?.name ?? "Agent"}
                              </div>
                              <div className="text-[10px] text-ink-3 font-mono">
                                {formatNumber(row.n)} tâches
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-sm tabular-nums">
                                {formatEur(Number(row.cost ?? 0))}
                              </div>
                              <div className="text-[10px] text-brand-green font-mono inline-flex items-center gap-1">
                                <TrendingUp className="size-3" /> actif
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Live activity feed */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Activité récente</h3>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-brand-green">
                    <span className="size-1.5 rounded-full bg-brand-green animate-pulse" />
                    LIVE
                  </span>
                </div>
                {recent.length === 0 ? (
                  <p className="text-sm text-ink-3 text-center py-8">
                    Aucune activité récente.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recent.map((t) => {
                      const a = agentsById[t.agentId];
                      const tpl = a ? getTemplate(a.templateSlug) : null;
                      return (
                        <li
                          key={t.id}
                          className="flex items-start gap-2.5 text-xs py-2 border-b border-line last:border-0"
                        >
                          <AgentIcon
                            name={tpl?.icon ?? "Bot"}
                            wrapperClassName="size-7 shrink-0"
                            size={12}
                          />
                          <div className="flex-1 min-w-0">
                            <div>
                              <span className="font-medium text-brand-blue-2">
                                {a?.name ?? "Agent"}
                              </span>{" "}
                              <span className="text-ink-2">
                                {t.status === "succeeded"
                                  ? "a terminé"
                                  : t.status === "failed"
                                    ? "a échoué sur"
                                    : "exécute"}
                                {" "}une tâche
                              </span>
                            </div>
                            <div className="text-ink-3 truncate">
                              {t.objective}
                            </div>
                          </div>
                          <span className="text-ink-3 text-[10px] font-mono shrink-0">
                            {relativeTime(t.createdAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
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
