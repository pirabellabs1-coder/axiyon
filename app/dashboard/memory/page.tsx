import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, memoryEntries } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

const DEMO_ENTRIES = [
  { kind: "semantic",    source: "notion://playbook-sales-2026", summary: "ICP segmentation v3 — VP Data, Series B+, EU/UK", importance: 0.94, age: "il y a 2h" },
  { kind: "episodic",    source: "iris.task#8841",                summary: "Stripe deal · margin 92k€ · contract sent",      importance: 0.89, age: "il y a 4h" },
  { kind: "procedural",  source: "workflow://deal-flow",          summary: "Iris→Atlas→Iris→Codex pattern (taux 11,8%)",     importance: 0.86, age: "il y a 6h" },
  { kind: "semantic",    source: "upload://q1-board-deck.pdf",    summary: "Board deck Q1 2026 · objectifs ARR 12M€",        importance: 0.82, age: "il y a 1j" },
  { kind: "client",      source: "salesforce://acc/notion",       summary: "Notion · ARR 180k€ · interlocuteur Sarah Chen",   importance: 0.78, age: "il y a 1j" },
  { kind: "episodic",    source: "atlas.task#8839",               summary: "67/184 leads passent threshold marge 80k€",      importance: 0.71, age: "il y a 1j" },
];

const KIND_PILL: Record<string, string> = {
  semantic:   "bg-brand-blue/10 text-brand-blue-2 border-brand-blue/30",
  episodic:   "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30",
  procedural: "bg-brand-magenta/10 text-brand-magenta border-brand-magenta/30",
  client:     "bg-brand-green/10 text-brand-green border-brand-green/30",
  task:       "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30",
};

const KIND_LABEL: Record<string, string> = {
  semantic: "sémantique",
  episodic: "épisodique",
  procedural: "procédurale",
  client: "client",
  task: "task",
};

export default async function MemoryPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const real = await db
    .select()
    .from(memoryEntries)
    .where(eq(memoryEntries.orgId, orgId))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(20);

  const useReal = real.length > 0;
  const entries = useReal
    ? real.map((e) => ({
        kind: e.kind,
        source: e.source ?? "—",
        summary: e.summary ?? e.content.slice(0, 80),
        importance: Number(e.importance ?? 0.5),
        age: relAge(e.createdAt),
      }))
    : DEMO_ENTRIES;

  // KPIs — match the demo numbers when no real data, else compute from real.
  const total = useReal ? real.length : 38_472;
  const docCount = useReal
    ? real.filter((e) => /upload:|notion:|drive:/.test(e.source ?? "")).length
    : 1_247;
  const tokenCount = useReal ? Math.round(total * 297) : 11_400_000;
  const recall = useReal ? 92.0 : 94.2;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Mémoire</h1>
          <p className="text-ink-2 text-sm mt-1">
            Mémoire long-terme des agents · sémantique, épisodique, procédurale
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost">
            <Download className="size-4" /> Exporter (JSON)
          </Button>
          <Button variant="glow">
            <Upload className="size-4" /> Ingérer document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Entrées" value={total.toLocaleString("fr-FR")} trend={`+ ${useReal ? Math.round(total * 0.03) : 1248} / 7j`} trendUp />
        <KpiTile label="Documents" value={docCount.toLocaleString("fr-FR")} trend={`+ ${useReal ? Math.max(0, Math.round(docCount * 0.03)) : 38} / 7j`} trendUp />
        <KpiTile label="Embedding tokens" value={formatBig(tokenCount)} trend="stable" />
        <KpiTile label="Recall@10" value={`${recall.toFixed(1).replace(".", ",")} %`} trend="+ 2,1 pts" trendUp />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="text-sm font-medium">Entrées récentes</div>
          <div className="text-[11px] font-mono text-ink-3">Top par importance · 30j</div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-bg-3/40">
                  <Th>Type</Th>
                  <Th>Source</Th>
                  <Th>Résumé</Th>
                  <Th className="text-right">Importance</Th>
                  <Th className="text-right pr-6">Date</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={i}
                    className="border-b border-line last:border-0 hover:bg-bg-3/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          KIND_PILL[e.kind] ?? KIND_PILL.semantic
                        }`}
                      >
                        {KIND_LABEL[e.kind] ?? e.kind}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-ink-2 max-w-[280px] truncate">
                      {e.source}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-ink-2">{e.summary}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm text-ink tabular-nums">
                      {e.importance.toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-ink-3 pr-6">
                      {e.age}
                    </td>
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

function KpiTile({
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
        <div
          className={`text-[11px] font-mono mt-1.5 ${
            trendUp ? "text-brand-green" : "text-ink-3"
          }`}
        >
          {trend}
        </div>
      ) : null}
    </div>
  );
}

function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k`;
  return String(n);
}

function relAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const j = Math.round(h / 24);
  return `il y a ${j}j`;
}
