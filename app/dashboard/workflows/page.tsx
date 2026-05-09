import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, workflows, workflowRuns } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Workflow, Plus, Play } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const wfs = await db
    .select()
    .from(workflows)
    .where(eq(workflows.orgId, orgId))
    .orderBy(desc(workflows.createdAt));

  const recentRuns = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.orgId, orgId))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Workflows</h1>
          <p className="text-ink-2 text-sm mt-1">
            Orchestrez plusieurs agents qui se passent la main automatiquement
          </p>
        </div>
        <Button variant="glow" asChild>
          <Link href="/dashboard/workflows/new">
            <Plus className="size-4" /> Nouveau workflow
          </Link>
        </Button>
      </div>

      {wfs.length === 0 ? (
        <Card className="p-12 text-center">
          <Workflow className="size-12 text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-lg font-medium mb-1">Aucun workflow encore</h3>
          <p className="text-ink-2 text-sm max-w-md mx-auto mb-6">
            Un workflow chaîne plusieurs agents (ex : Iris source des leads → Atlas qualifie
            la marge → Codex prépare le contrat) avec passages de relais et approbations
            humaines aux moments clés.
          </p>
          <Button variant="glow" asChild>
            <Link href="/dashboard/workflows/new">
              <Plus className="size-4" /> Créer mon premier workflow
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {wfs.map((w) => (
            <Card key={w.id} className="p-5 hover:border-line-2 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <Link
                  href={`/dashboard/workflows/${w.slug}`}
                  className="flex-1 min-w-0 group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium group-hover:text-brand-blue-2 transition-colors">
                      {w.name}
                    </h3>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded border ${
                        w.status === "published"
                          ? "bg-brand-green/10 text-brand-green border-brand-green/30"
                          : w.status === "archived"
                            ? "bg-ink-3/10 text-ink-3 border-line"
                            : "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30"
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                  {w.description ? (
                    <p className="text-sm text-ink-2">{w.description}</p>
                  ) : null}
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-ink-3">
                    <span>v{w.version}</span>
                    {w.scheduleCron ? <span>cron: {w.scheduleCron}</span> : null}
                  </div>
                </Link>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/workflows/${w.slug}`}>
                    <Play className="size-3.5" /> Exécuter
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {recentRuns.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-line text-sm font-medium">
            Exécutions récentes
          </div>
          <div className="divide-y divide-line">
            {recentRuns.map((r) => (
              <div
                key={r.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-bg-3/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono">{r.id.slice(0, 8)}</div>
                  <div className="text-[11px] text-ink-3 font-mono">
                    {r.startedAt
                      ? new Date(r.startedAt).toLocaleString("fr-FR")
                      : "—"}
                    {" · "}
                    triggered by {r.triggeredBy}
                  </div>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded border ${
                    r.status === "succeeded"
                      ? "bg-brand-green/10 text-brand-green border-brand-green/30"
                      : r.status === "failed"
                        ? "bg-brand-red/10 text-brand-red border-brand-red/30"
                        : r.status === "running"
                          ? "bg-brand-blue/10 text-brand-blue-2 border-brand-blue/30"
                          : "bg-ink-3/10 text-ink-3 border-line"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
