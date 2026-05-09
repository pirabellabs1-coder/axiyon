import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { agentInstances, db, workflowRuns, workflows } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { CATALOG } from "@/lib/agents/catalog";
import type { WorkflowSpec } from "@/lib/workflows/types";
import { WorkflowDetailClient } from "./workflow-detail-client";

export const dynamic = "force-dynamic";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const wfRows = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.orgId, orgId), eq(workflows.slug, slug)))
    .orderBy(desc(workflows.version))
    .limit(1);
  const wf = wfRows[0];
  if (!wf) notFound();

  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, wf.id))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(20);

  const agents = await db
    .select({
      id: agentInstances.id,
      templateSlug: agentInstances.templateSlug,
      enabledTools: agentInstances.enabledTools,
      customPrompt: agentInstances.customPrompt,
    })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId));

  const spec = wf.spec as unknown as WorkflowSpec;

  // Augment steps with display metadata.
  const stepsMeta = spec.steps.map((s) => {
    const tpl = CATALOG[s.agent_slug];
    return {
      ...s,
      agentName: tpl?.name ?? s.agent_slug,
      agentRole: tpl?.role ?? "",
      icon: tpl?.icon ?? "Bot",
      hasInstance: agents.some((a) => a.templateSlug === s.agent_slug),
    };
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/dashboard/workflows"
        className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" /> Tous les workflows
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">{wf.name}</h1>
          {wf.description ? (
            <p className="text-ink-2 mt-1.5 text-sm max-w-2xl">{wf.description}</p>
          ) : null}
          <div className="flex gap-3 mt-2 text-[11px] font-mono text-ink-3">
            <span>v{wf.version}</span>
            <span>·</span>
            <span>{spec.steps.length} étapes</span>
            {wf.scheduleCron ? (
              <>
                <span>·</span>
                <span>cron: {wf.scheduleCron}</span>
              </>
            ) : null}
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded border ${
            wf.status === "published"
              ? "bg-brand-green/10 text-brand-green border-brand-green/30"
              : "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30"
          }`}
        >
          {wf.status}
        </span>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-medium">Lancer ce workflow</h3>
          <p className="text-sm text-ink-2">
            L&apos;exécution se fait dans votre navigateur (Puter). Chaque étape attend ses
            dépendances avant de partir.
          </p>
          <WorkflowDetailClient
            slug={wf.slug}
            spec={spec}
            stepsMeta={stepsMeta}
            agentInstances={agents.map((a) => ({
              id: a.id,
              templateSlug: a.templateSlug,
              enabledTools: (a.enabledTools as string[] | null) ?? [],
              customPrompt: a.customPrompt,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-3">Exécutions précédentes</h3>
          {runs.length === 0 ? (
            <p className="text-sm text-ink-2">Aucune exécution encore.</p>
          ) : (
            <ul className="divide-y divide-line">
              {runs.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-ink-3">{r.id.slice(0, 8)}</span>
                  <span className="text-ink-3 text-xs">
                    {r.startedAt
                      ? new Date(r.startedAt).toLocaleString("fr-FR")
                      : new Date(r.createdAt).toLocaleString("fr-FR")}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded border ${
                      r.status === "succeeded"
                        ? "bg-brand-green/10 text-brand-green border-brand-green/30"
                        : r.status === "failed"
                          ? "bg-brand-red/10 text-brand-red border-brand-red/30"
                          : "bg-brand-blue/10 text-brand-blue-2 border-brand-blue/30"
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
