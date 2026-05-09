import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, memoryEntries } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Download, Upload } from "lucide-react";
import { IngestButton } from "./ingest-button";

export const dynamic = "force-dynamic";

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

  const [entries, totalRow] = await Promise.all([
    db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.orgId, orgId))
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
      .limit(20),
    db
      .select({ n: count() })
      .from(memoryEntries)
      .where(eq(memoryEntries.orgId, orgId)),
  ]);
  const total = totalRow[0]?.n ?? 0;

  const docCount = entries.filter((e) =>
    /upload:|notion:|drive:|s3:/.test(e.source ?? ""),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Mémoire</h1>
          <p className="text-ink-2 text-sm mt-1">
            Mémoire long-terme de vos agents · sémantique, épisodique, procédurale
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={total === 0} asChild>
            <a href="/api/v1/memory/export" download>
              <Download className="size-4" /> Exporter (JSON)
            </a>
          </Button>
          <IngestButton />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Entrées" value={total.toLocaleString("fr-FR")} />
        <KpiTile label="Documents" value={docCount.toLocaleString("fr-FR")} />
        <KpiTile label="Embedding tokens" value={total > 0 ? `~${formatBig(total * 297)}` : "—"} />
        <KpiTile label="Recall@10" value={total > 10 ? "—" : "—"} sub="bientôt" />
      </div>

      {entries.length === 0 ? (
        <Card className="p-12 text-center">
          <Brain className="size-12 text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-lg font-medium mb-1">Aucune mémoire pour l&apos;instant</h3>
          <p className="text-ink-2 text-sm max-w-md mx-auto mb-6">
            Vos agents construiront automatiquement leur mémoire en travaillant. Vous
            pouvez aussi ingérer manuellement des documents (playbooks, rapports, etc.) pour
            qu&apos;ils s&apos;en servent comme contexte.
          </p>
          <IngestButton />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="text-sm font-medium">Entrées récentes</div>
            <div className="text-[11px] font-mono text-ink-3">Top par importance</div>
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
                  {entries.map((e) => (
                    <tr
                      key={e.id}
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
                        {e.source ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-ink-2 max-w-[420px] truncate">
                        {e.summary ?? e.content.slice(0, 80)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-sm text-ink tabular-nums">
                        {Number(e.importance ?? 0.5).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-ink-3 pr-6">
                        {relAge(e.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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

function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k`;
  return String(n);
}

function relAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const j = Math.round(h / 24);
  return `il y a ${j}j`;
}
