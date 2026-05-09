import { redirect } from "next/navigation";
import { count, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, memoryEntries } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Network } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KnowledgeGraphPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  // The KG is materialised from memory entries metadata (entities + refs).
  // For now we count distinct sources (proxy for entities) and the row count.
  const [entitiesRow, totalRow] = await Promise.all([
    db
      .select({
        n: sql<number>`COUNT(DISTINCT ${memoryEntries.source})::int`,
      })
      .from(memoryEntries)
      .where(eq(memoryEntries.orgId, orgId)),
    db
      .select({ n: count() })
      .from(memoryEntries)
      .where(eq(memoryEntries.orgId, orgId)),
  ]);
  const entityCount = Number(entitiesRow[0]?.n ?? 0);
  const totalRefs = Number(totalRow[0]?.n ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Knowledge graph</h1>
        <p className="text-ink-2 text-sm mt-1">
          Entités · relations · contexte partagé entre agents
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Entités" value={entityCount.toLocaleString("fr-FR")} />
        <Kpi label="Références" value={totalRefs.toLocaleString("fr-FR")} />
        <Kpi label="Confiance moyenne" value={entityCount > 0 ? "—" : "—"} sub="bientôt" />
        <Kpi label="Doublons résolus" value="0" sub="auto-merge" />
      </div>

      <Card className="p-12 text-center">
        <Network className="size-12 text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <h3 className="text-lg font-medium mb-1">
          {entityCount === 0
            ? "Aucune entité encore"
            : `${entityCount} entités identifiées`}
        </h3>
        <p className="text-ink-2 text-sm max-w-md mx-auto">
          Le knowledge graph se construit automatiquement quand vos agents
          travaillent — chaque entreprise mentionnée, chaque contact contacté, chaque
          contrat signé devient un nœud avec ses relations.
        </p>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 px-5 py-4">
      <div className="text-xs text-ink-2 mb-1">{label}</div>
      <div className="text-2xl font-medium tracking-tight">{value}</div>
      {sub ? <div className="text-[11px] font-mono mt-1.5 text-ink-3">{sub}</div> : null}
    </div>
  );
}
