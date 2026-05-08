import Link from "next/link";
import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import { auth } from "@/auth";
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
} from "lucide-react";

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
          Bonjour, {session.user.name ?? session.user.email}
        </h1>
        <p className="text-ink-2 mt-1.5">
          {org?.name} · plan {org?.tier} · {formatNumber(org?.taskQuotaMonthly ?? 0)} tâches/mois inclus
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          icon={Users}
          label="Agents actifs"
          value={String(agents.filter((a) => a.status !== "archived").length)}
          accent="text-brand-blue"
        />
        <KPI
          icon={CheckCircle2}
          label="Tâches ce mois"
          value={formatNumber(totalTasks ?? 0)}
          accent="text-brand-green"
        />
        <KPI
          icon={Coins}
          label="Coût ce mois"
          value={formatEur(totalCost ?? 0)}
          accent="text-brand-cyan"
        />
        <KPI
          icon={Clock}
          label="Durée moyenne"
          value={avgDuration ? `${(avgDuration / 1000).toFixed(1)} s` : "—"}
          accent="text-brand-magenta"
        />
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <AgentIcon name="Sparkles" size={28} wrapperClassName="size-14 rounded-xl mx-auto" gradient />
            <CardTitle>Recrutez votre premier agent</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Iris, Atlas, Sage, Codex, Nova, Forge, Lumen, Quill — choisissez parmi {TEMPLATES.length}{" "}
              agents prêts à travailler.
            </CardDescription>
            <Button asChild variant="glow">
              <Link href="/dashboard/agents/hire">
                <Plus className="size-4" /> Recruter un agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Vos agents</h2>
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
                a.status === "running" ? Activity :
                a.status === "error" ? AlertCircle :
                a.status === "paused" ? Pause : Activity;
              const statusColor =
                a.status === "running" ? "text-brand-blue" :
                a.status === "error" ? "text-brand-red" :
                a.status === "paused" ? "text-ink-3" : "text-brand-green";
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
                      <div className="text-xs text-ink-2 mt-0.5">{tpl?.role ?? a.templateSlug}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${statusColor}`}>
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
      )}

      {recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Activité récente</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/tasks">
                Toutes les tâches <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <Card>
            <ul className="divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                  <span
                    className={
                      "size-2 rounded-full shrink-0 " +
                      (t.status === "succeeded" ? "bg-brand-green" :
                       t.status === "failed" ? "bg-brand-red" :
                       t.status === "running" ? "bg-brand-blue animate-pulse" : "bg-ink-3")
                    }
                  />
                  <span className="flex-1 truncate text-ink-2">{t.objective}</span>
                  <span className="text-ink-3 font-mono text-xs tabular-nums">
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

function KPI({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-xs text-ink-2">{label}</div>
          <Icon className={`size-4 ${accent}`} />
        </div>
        <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
