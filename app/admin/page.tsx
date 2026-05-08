import Link from "next/link";
import { count, desc, gte, sql, sum, and } from "drizzle-orm";
import {
  Users,
  Building2,
  Bot,
  CheckCircle2,
  Coins,
  Shield,
  Plug,
  Activity,
  ArrowRight,
} from "lucide-react";

import {
  agentInstances,
  approvals,
  auditLogs,
  db,
  integrations,
  orgs,
  tasks,
  users,
} from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEur, formatNumber, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const yesterday = new Date(Date.now() - 24 * 3600_000);
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const [{ usersCount }] = await db.select({ usersCount: count(users.id) }).from(users);
  const [{ orgsCount }] = await db.select({ orgsCount: count(orgs.id) }).from(orgs);
  const [{ agentsCount }] = await db.select({ agentsCount: count(agentInstances.id) }).from(agentInstances);
  const [{ tasksCount, tokens, cost }] = await db
    .select({
      tasksCount: count(tasks.id),
      tokens: sql<number>`coalesce(sum(${tasks.tokensIn} + ${tasks.tokensOut}), 0)`.mapWith(Number),
      cost: sum(tasks.costEur).mapWith(Number),
    })
    .from(tasks);

  const [{ tasks24h }] = await db
    .select({ tasks24h: count(tasks.id) })
    .from(tasks)
    .where(gte(tasks.createdAt, yesterday));

  const [{ auditCount }] = await db.select({ auditCount: count(auditLogs.id) }).from(auditLogs);
  const [{ integCount }] = await db
    .select({ integCount: count(integrations.id) })
    .from(integrations);
  const [{ pendingAppr }] = await db
    .select({ pendingAppr: count(approvals.id) })
    .from(approvals)
    .where(sql`${approvals.status} = 'pending'`);

  // Recent signups
  const recentUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(5);

  // Top orgs by activity (this month)
  const topOrgs = await db
    .select({
      orgId: tasks.orgId,
      cost: sum(tasks.costEur).mapWith(Number),
      n: count(tasks.id),
    })
    .from(tasks)
    .where(gte(tasks.createdAt, periodStart))
    .groupBy(tasks.orgId)
    .orderBy(desc(sql`coalesce(sum(${tasks.costEur}),0)`))
    .limit(5);

  const orgRows = await db
    .select({ id: orgs.id, name: orgs.name, tier: orgs.tier })
    .from(orgs);
  const orgMap = Object.fromEntries(orgRows.map((o) => [o.id, o]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Console Admin</h1>
        <p className="text-ink-2 mt-1.5">
          Vue plate-forme. Données live de Postgres.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Utilisateurs" value={formatNumber(usersCount ?? 0)} icon={Users} accent="text-brand-blue" />
        <KPI label="Organisations" value={formatNumber(orgsCount ?? 0)} icon={Building2} accent="text-brand-magenta" />
        <KPI label="Agents recrutés" value={formatNumber(agentsCount ?? 0)} icon={Bot} accent="text-brand-cyan" />
        <KPI label="Tâches totales" value={formatNumber(tasksCount ?? 0)} icon={CheckCircle2} accent="text-brand-green" />
        <KPI label="Tokens IA" value={formatNumber(tokens ?? 0)} icon={Activity} accent="text-ink-2" />
        <KPI label="Coût cumulé" value={formatEur(cost ?? 0)} icon={Coins} accent="text-brand-yellow" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile
          icon={Activity}
          label="Tâches dernières 24 h"
          value={formatNumber(tasks24h ?? 0)}
          accent="text-brand-green"
        />
        <Tile
          icon={Plug}
          label="Intégrations connectées"
          value={formatNumber(integCount ?? 0)}
          accent="text-brand-blue-2"
        />
        <Tile
          icon={Shield}
          label="Approbations en attente"
          value={formatNumber(pendingAppr ?? 0)}
          accent={pendingAppr && pendingAppr > 0 ? "text-brand-yellow" : "text-ink-2"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Inscriptions récentes</h3>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/users">
                  Voir tous <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <ul className="divide-y divide-line">
              {recentUsers.map((u) => (
                <li
                  key={u.id}
                  className="py-2.5 flex items-center gap-3"
                >
                  <div className="size-8 rounded-full bg-grad text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-xs text-ink-3 font-mono truncate">{u.email}</div>
                  </div>
                  {u.isSuperuser && (
                    <span className="text-[10px] font-mono text-brand-magenta bg-brand-magenta/10 border border-brand-magenta/30 px-1.5 py-0.5 rounded">
                      SUPER
                    </span>
                  )}
                  <span className="text-[10px] text-ink-3 font-mono">
                    {relativeTime(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Top organisations · ce mois</h3>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/orgs">
                  Voir toutes <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            {topOrgs.length === 0 ? (
              <p className="text-sm text-ink-3">Aucune activité ce mois.</p>
            ) : (
              <ul className="divide-y divide-line">
                {topOrgs.map((row) => {
                  const o = orgMap[row.orgId];
                  return (
                    <li
                      key={row.orgId}
                      className="py-2.5 flex items-center gap-3"
                    >
                      <div className="size-8 rounded-md bg-bg-3 border border-line flex items-center justify-center shrink-0">
                        <Building2 className="size-4 text-brand-magenta" strokeWidth={1.6} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{o?.name ?? "—"}</div>
                        <div className="text-xs text-ink-3 font-mono">
                          {formatNumber(row.n)} tâches · plan {o?.tier ?? "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm tabular-nums">
                          {formatEur(Number(row.cost ?? 0))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-medium flex items-center gap-2">
            <Shield className="size-4 text-brand-blue-2" /> Audit log
          </h3>
          <p className="text-sm text-ink-2">
            <span className="font-mono text-ink">{formatNumber(auditCount ?? 0)}</span>{" "}
            événements stockés. Chaîne SHA-256 vérifiable depuis chaque organisation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-xs text-ink-2">{label}</div>
          <Icon className={`size-3.5 ${accent}`} />
        </div>
        <div className="text-xl font-medium tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`size-12 rounded-xl bg-bg-3 border border-line flex items-center justify-center shrink-0`}>
          <Icon className={`size-6 ${accent}`} strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-xs text-ink-2 mb-1">{label}</div>
          <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
