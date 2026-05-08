import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Gauge,
} from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";
import {
  agentInstances,
  db,
  orgs,
  tasks,
  type Org,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEur, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIER_INFO: Record<
  string,
  { label: string; price: string; tasks: number; color: string }
> = {
  solo: { label: "Solo", price: "Gratuit", tasks: 1_000, color: "text-ink-2" },
  growth: { label: "Growth", price: "299 €/agent/mois", tasks: 25_000, color: "text-brand-blue-2" },
  enterprise: { label: "Enterprise", price: "Sur devis", tasks: 100_000, color: "text-brand-magenta" },
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const org: Org | undefined = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (!org) redirect("/login");

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const [usage] = await db
    .select({
      tasks: count(tasks.id),
      cost: sum(tasks.costEur).mapWith(Number),
      tokensIn: sum(tasks.tokensIn).mapWith(Number),
      tokensOut: sum(tasks.tokensOut).mapWith(Number),
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), gte(tasks.createdAt, periodStart)));

  const [agentCount] = await db
    .select({ n: count(agentInstances.id) })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId));

  // Top spending agents this month
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
    .limit(5);

  const agents = await db
    .select({ id: agentInstances.id, name: agentInstances.name })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId));
  const agentName = Object.fromEntries(agents.map((a) => [a.id, a.name]));

  const tier = TIER_INFO[org.tier as keyof typeof TIER_INFO] ?? TIER_INFO.solo;
  const usagePct = Math.round((Number(usage.tasks ?? 0) / org.taskQuotaMonthly) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Facturation</h1>
        <p className="text-ink-2 mt-1.5">
          Suivez votre consommation, votre plan et votre historique de paiements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Current plan */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-ink-2 uppercase tracking-wider font-mono mb-1">
                  Plan actuel
                </div>
                <div className={`text-3xl font-medium tracking-tight ${tier.color}`}>
                  {tier.label}
                </div>
                <div className="text-sm text-ink-2 mt-1 font-mono">{tier.price}</div>
              </div>
              <div className="size-12 rounded-xl bg-grad shadow-glow flex items-center justify-center">
                <Wallet className="size-6 text-white" strokeWidth={1.6} />
              </div>
            </div>
            <div className="pt-4 border-t border-line">
              <Button asChild variant="outline" className="w-full">
                <Link href="/pricing">Voir les plans + changer</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage gauge */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-ink-2 uppercase tracking-wider font-mono mb-1">
                  Tâches ce mois
                </div>
                <div className="text-3xl font-medium tracking-tight">
                  {formatNumber(Number(usage.tasks ?? 0))}{" "}
                  <span className="text-ink-3 text-base font-normal">/{formatNumber(org.taskQuotaMonthly)}</span>
                </div>
              </div>
              <div
                className={`size-12 rounded-xl flex items-center justify-center ${
                  usagePct >= 100
                    ? "bg-brand-red/20"
                    : usagePct >= 80
                      ? "bg-brand-yellow/20"
                      : "bg-brand-green/20"
                }`}
              >
                <Gauge
                  className={`size-6 ${
                    usagePct >= 100
                      ? "text-brand-red"
                      : usagePct >= 80
                        ? "text-brand-yellow"
                        : "text-brand-green"
                  }`}
                  strokeWidth={1.6}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-ink-2">Consommation</span>
                <span className="text-ink">{usagePct}%</span>
              </div>
              <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usagePct >= 100
                      ? "bg-brand-red"
                      : usagePct >= 80
                        ? "bg-brand-yellow"
                        : "bg-grad"
                  }`}
                  style={{ width: `${Math.min(100, usagePct)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          icon={Coins}
          label="Coût IA ce mois"
          value={formatEur(Number(usage.cost ?? 0))}
          accent="text-brand-cyan"
        />
        <KpiTile
          icon={CheckCircle2}
          label="Agents actifs"
          value={formatNumber(agentCount?.n ?? 0)}
          accent="text-brand-blue"
        />
        <KpiTile
          icon={TrendingUp}
          label="Tokens entrée"
          value={formatNumber(Number(usage.tokensIn ?? 0))}
          accent="text-ink-2"
        />
        <KpiTile
          icon={TrendingUp}
          label="Tokens sortie"
          value={formatNumber(Number(usage.tokensOut ?? 0))}
          accent="text-ink-2"
        />
      </div>

      {topAgents.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-medium">Top agents par coût · ce mois</h3>
            <ul className="divide-y divide-line">
              {topAgents.map((row) => (
                <li
                  key={row.agentId}
                  className="py-2.5 flex items-center justify-between text-sm"
                >
                  <span>{agentName[row.agentId] ?? "Agent"}</span>
                  <span className="text-ink-3 text-xs font-mono">
                    {formatNumber(row.n)} tâches
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {formatEur(Number(row.cost ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {usagePct >= 80 && (
        <Card className="border-brand-yellow/30 bg-brand-yellow/[0.04]">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="size-5 text-brand-yellow shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-brand-yellow">
                Vous avez utilisé {usagePct}% de votre quota mensuel
              </div>
              <p className="text-sm text-ink-2 mt-1">
                Vous approchez de la limite de votre plan. Passez à un plan supérieur
                pour continuer sans interruption.
              </p>
              <Button asChild variant="glow" size="sm" className="mt-3">
                <Link href="/pricing">Mettre à niveau →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiTile({
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
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-xs text-ink-2">{label}</div>
          <Icon className={`size-4 ${accent}`} />
        </div>
        <div className="text-xl font-medium tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
