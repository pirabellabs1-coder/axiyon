import { count, sql, sum } from "drizzle-orm";
import {
  agentInstances,
  auditLogs,
  db,
  orgs,
  tasks,
  users,
} from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { formatEur, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
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
  const [{ auditCount }] = await db.select({ auditCount: count(auditLogs.id) }).from(auditLogs);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Console Admin</h1>
        <p className="text-ink-2 mt-1">
          Vue plate-forme. Données live de Postgres.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Utilisateurs" value={formatNumber(usersCount ?? 0)} />
        <KPI label="Organisations" value={formatNumber(orgsCount ?? 0)} />
        <KPI label="Agents" value={formatNumber(agentsCount ?? 0)} />
        <KPI label="Tâches totales" value={formatNumber(tasksCount ?? 0)} />
        <KPI label="Tokens consommés" value={formatNumber(tokens ?? 0)} />
        <KPI label="Coût cumulé" value={formatEur(cost ?? 0)} />
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-medium mb-3">Audit log</h2>
          <p className="text-sm text-ink-2">
            <span className="font-mono text-ink">{formatNumber(auditCount ?? 0)}</span>{" "}
            événements stockés sur l'ensemble de la plate-forme.
          </p>
        </CardContent>
      </Card>
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
