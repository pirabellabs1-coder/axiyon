import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TOP_ENTITIES = [
  { name: "Stripe",                   type: "company",  refs: 847, agents: ["Iris", "Atlas", "Codex", "Sage"], age: "il y a 12 min" },
  { name: "Sarah Chen",               type: "contact",  refs: 284, agents: ["Iris", "Sage"],                    age: "il y a 2h" },
  { name: "Margin threshold v2",      type: "policy",   refs: 211, agents: ["Atlas", "Codex"],                  age: "il y a 1j" },
  { name: "EU GDPR template DPA",     type: "document", refs: 189, agents: ["Codex", "Sage"],                   age: "il y a 3j" },
  { name: "VP Data ICP 2026",         type: "segment",  refs: 168, agents: ["Iris", "Atlas", "Lumen"],          age: "il y a 4j" },
];

export default async function KnowledgeGraphPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Knowledge graph</h1>
        <p className="text-ink-2 text-sm mt-1">Entités · relations · contexte partagé entre agents</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Entités" value="12 488" trend="+ 412 / 7j" trendUp />
        <Kpi label="Relations" value="38 102" trend="+ 1 247" trendUp />
        <Kpi label="Confiance moyenne" value="0,88" trend="+ 0,02" trendUp />
        <Kpi label="Doublons résolus" value="218" trend="auto-merge" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="text-sm font-medium">Top entités · valeur traversale</div>
          <div className="text-[11px] font-mono text-ink-3">Référencées par ≥ 4 agents</div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-bg-3/40">
                  <Th>Entité</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Refs</Th>
                  <Th>Agents</Th>
                  <Th className="text-right pr-6">Dernière mise à jour</Th>
                </tr>
              </thead>
              <tbody>
                {TOP_ENTITIES.map((e) => (
                  <tr
                    key={e.name}
                    className="border-b border-line last:border-0 hover:bg-bg-3/40 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-sm">{e.name}</td>
                    <td className="px-5 py-3.5 text-sm text-ink-2">{e.type}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm text-ink tabular-nums">
                      {e.refs.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-ink-2">{e.agents.join(" · ")}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-ink-3 pr-6">{e.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3 ${
        className ?? ""
      }`}
    >
      {children}
    </th>
  );
}

function Kpi({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 px-5 py-4">
      <div className="text-xs text-ink-2 mb-1">{label}</div>
      <div className="text-2xl font-medium tracking-tight">{value}</div>
      {trend ? (
        <div className={`text-[11px] font-mono mt-1.5 ${trendUp ? "text-brand-green" : "text-ink-3"}`}>
          {trend}
        </div>
      ) : null}
    </div>
  );
}
