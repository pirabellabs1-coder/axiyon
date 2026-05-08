import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { ArrowLeft, Activity, AlertCircle, Pause } from "lucide-react";

import { auth } from "@/auth";
import { agentInstances, db, tasks } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { categoryLabel, getTemplate } from "@/lib/agents/catalog";
import { formatEur, relativeTime } from "@/lib/utils";
import { AgentIcon } from "@/components/agent-icon";
import { RunForm } from "./run-form";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const agent = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, id),
  });
  if (!agent || agent.orgId !== orgId) notFound();

  const template = getTemplate(agent.templateSlug);

  const recentTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.agentId, agent.id))
    .orderBy(sql`${tasks.createdAt} DESC`)
    .limit(20);

  const StatusIcon =
    agent.status === "running" ? Activity :
    agent.status === "error" ? AlertCircle :
    agent.status === "paused" ? Pause : Activity;
  const statusColor =
    agent.status === "running" ? "text-brand-blue" :
    agent.status === "error" ? "text-brand-red" :
    agent.status === "paused" ? "text-ink-3" : "text-brand-green";

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/dashboard/agents"
        className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" /> Tous les agents
      </Link>

      <div className="flex items-start gap-4">
        <AgentIcon name={template?.icon ?? "Bot"} size={26} wrapperClassName="size-14 rounded-xl" gradient />
        <div className="flex-1">
          <h1 className="text-2xl font-medium leading-tight">
            <span className="text-brand-blue-2">{agent.name}</span>
            <span className="text-ink-2 text-base ml-2 font-normal">· {template?.role}</span>
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            {template?.description}{" "}
            {template && (
              <span className="text-ink-3">· {categoryLabel(template.category)}</span>
            )}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-mono mt-1 ${statusColor}`}>
          <StatusIcon className="size-3" /> {agent.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-ink-2 mb-1">Tâches aujourd'hui</div><div className="text-xl font-medium font-mono tabular-nums">{agent.tasksToday}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-ink-2 mb-1">Santé</div><div className="text-xl font-medium font-mono tabular-nums">{Math.round((agent.healthScore ?? 1) * 100)}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-ink-2 mb-1">Budget €/jour</div><div className="text-xl font-medium font-mono tabular-nums">{agent.budgetPerDayEur}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-ink-2 mb-1">Dernière exéc.</div><div className="text-xl font-medium">{relativeTime(agent.lastRunAt)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-medium mb-2">Lancer une tâche</h3>
            <p className="text-sm text-ink-2">
              Donnez un objectif clair. L'agent va planifier, appeler ses outils et vous rendre un résultat.
            </p>
          </div>
          {template && (
            <RunForm
              agent={{
                id: agent.id,
                name: agent.name,
                templateSlug: agent.templateSlug,
                enabledTools: (agent.enabledTools as string[] | null) ?? [],
                customPrompt: agent.customPrompt,
              }}
              template={template}
              suggestedObjective={defaultObjective(agent.templateSlug)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-4">Tâches récentes</h3>
          {recentTasks.length === 0 ? (
            <p className="text-sm text-ink-2">Pas encore de tâche. Lancez la première !</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentTasks.map((task) => (
                <li key={task.id} className="py-3 flex items-center gap-3 text-sm">
                  <span
                    className={
                      "size-2 rounded-full shrink-0 " +
                      (task.status === "succeeded" ? "bg-brand-green" :
                       task.status === "failed" ? "bg-brand-red" :
                       task.status === "running" ? "bg-brand-blue animate-pulse" : "bg-ink-3")
                    }
                  />
                  <span className="flex-1 truncate text-ink">{task.objective}</span>
                  <span className="text-xs text-ink-3 font-mono w-14 text-right tabular-nums">
                    {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : "—"}
                  </span>
                  <span className="text-xs text-ink-3 font-mono w-16 text-right tabular-nums">
                    {formatEur(task.costEur ?? 0)}
                  </span>
                  <span className="text-xs text-ink-3 w-24 text-right">{relativeTime(task.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function defaultObjective(slug: string): string {
  return ({
    "sdr-outbound": "Trouve 10 prospects ICP « VP Data, Series B+, Europe » et qualifie-les.",
    "cfo-assistant": "Donne-moi un résumé de la santé financière du mois courant.",
    "support-l2": "Le client signale : « mes dashboards ne se chargent plus depuis 1h ». Diagnostique.",
    "legal-counsel": "Revois ce paragraphe de NDA : « Confidential Information shall mean... »",
    "recruiter": "Source 5 candidats pour un poste de Senior Backend Engineer en remote EU.",
    "devops": "Quelles sont les PRs ouvertes ? Y a-t-il des erreurs récentes en logs ?",
    "growth-marketer": "Suggère 3 expériences A/B pour augmenter le CTR de mes campagnes.",
    "content-writer": "Écris 3 titres SEO pour un article sur l'IA agentique en B2B.",
  } as Record<string, string>)[slug] ?? "Décris ton objectif ici.";
}
