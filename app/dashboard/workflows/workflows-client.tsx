"use client";
import { useEffect, useState } from "react";
import {
  Play,
  Loader2,
  Plus,
  Workflow as WorkflowIcon,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentIcon } from "@/components/agent-icon";
import { CATALOG } from "@/lib/agents/catalog";
import {
  runWorkflow,
  type RunOutcome,
} from "@/lib/workflows/runner";
import type { WorkflowSpec, WorkflowStepOutput } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface WF {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  spec: WorkflowSpec;
  scheduleCron: string | null;
}

interface AgentLite {
  id: string;
  name: string;
  templateSlug: string;
  enabledTools: string[];
  customPrompt: string | null;
}

export function WorkflowsClient({ hiredAgents }: { hiredAgents: AgentLite[] }) {
  const [list, setList] = useState<WF[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setList(data);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const active = activeSlug ? list.find((w) => w.slug === activeSlug) : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Workflows</h1>
          <p className="text-ink-2 mt-1.5">Chargement…</p>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <WorkflowDetail
        workflow={active}
        hiredAgents={hiredAgents}
        onBack={() => setActiveSlug(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Workflows</h1>
          <p className="text-ink-2 mt-1.5">
            Orchestrez plusieurs agents en chaîne. Chaque workflow peut être
            lancé à la demande ou sur planning cron.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <AgentIcon name="Workflow" size={28} wrapperClassName="size-14 rounded-xl mx-auto" gradient />
            <p className="text-ink-2">Aucun workflow configuré pour l'instant.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((wf) => (
            <Card
              key={wf.id}
              className="hover:border-brand-blue transition-colors cursor-pointer"
              onClick={() => setActiveSlug(wf.slug)}
            >
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <AgentIcon name="Workflow" wrapperClassName="size-11" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium leading-tight flex items-center gap-2">
                      {wf.name}
                      <span className="text-[10px] font-mono text-ink-3">
                        v{wf.version}
                      </span>
                    </div>
                    <div className="text-xs text-ink-2 mt-1 line-clamp-2">
                      {wf.description}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-ink-3 shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between text-xs text-ink-3 font-mono">
                  <span>
                    {wf.spec.steps.length} étape{wf.spec.steps.length > 1 ? "s" : ""}
                  </span>
                  {wf.scheduleCron && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {wf.scheduleCron}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowDetail({
  workflow,
  hiredAgents,
  onBack,
}: {
  workflow: WF;
  hiredAgents: AgentLite[];
  onBack: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Record<string, WorkflowStepOutput>>(() =>
    Object.fromEntries(
      workflow.spec.steps.map((s) => [
        s.id,
        { id: s.id, agent_slug: s.agent_slug, status: "pending" as const },
      ]),
    ),
  );
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);

  useEffect(() => {
    fetch(`/api/workflows/${workflow.slug}/runs`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setHistory(data))
      .catch(() => undefined);
  }, [workflow.slug]);

  async function onRun() {
    setRunning(true);
    setOutcome(null);
    setSteps(
      Object.fromEntries(
        workflow.spec.steps.map((s) => [
          s.id,
          { id: s.id, agent_slug: s.agent_slug, status: "pending" as const },
        ]),
      ),
    );
    try {
      const r = await runWorkflow(workflow.slug, workflow.spec, {}, hiredAgents, {
        onStepStart: (id) =>
          setSteps((prev) => ({
            ...prev,
            [id]: { ...prev[id], status: "running" },
          })),
        onStepFinish: (out) =>
          setSteps((prev) => ({ ...prev, [out.id]: out })),
      });
      setOutcome(r);
    } catch (e) {
      setOutcome({
        status: "failed",
        steps: [],
        totalToolCalls: 0,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" /> Tous les workflows
      </button>

      <div className="flex items-start gap-4">
        <AgentIcon name="Workflow" size={26} wrapperClassName="size-14 rounded-xl" gradient />
        <div className="flex-1">
          <h1 className="text-2xl font-medium leading-tight">
            {workflow.name}{" "}
            <span className="text-base text-ink-3 font-normal font-mono">
              v{workflow.version}
            </span>
          </h1>
          <p className="text-sm text-ink-2 mt-1">{workflow.description}</p>
        </div>
        <Button onClick={onRun} disabled={running} variant="glow">
          {running ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Exécution…
            </>
          ) : (
            <>
              <Play className="size-4" /> Lancer
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-medium">Étapes</h3>
          <ol className="space-y-2">
            {workflow.spec.steps.map((step, i) => {
              const tpl = CATALOG[step.agent_slug];
              const out = steps[step.id];
              const StatusIcon =
                out?.status === "succeeded" ? CheckCircle2 :
                out?.status === "failed" ? XCircle :
                out?.status === "running" ? Loader2 : Clock;
              const statusColor =
                out?.status === "succeeded" ? "text-brand-green" :
                out?.status === "failed" ? "text-destructive" :
                out?.status === "running" ? "text-brand-blue" : "text-ink-3";
              return (
                <li
                  key={step.id}
                  className={cn(
                    "rounded-md border p-3 flex items-start gap-3",
                    out?.status === "succeeded" && "border-brand-green/30 bg-brand-green/5",
                    out?.status === "failed" && "border-destructive/30 bg-destructive/5",
                    out?.status === "running" && "border-brand-blue/40 bg-brand-blue/5",
                    (!out || out.status === "pending") && "border-line bg-bg-3",
                  )}
                >
                  <span className="text-[10px] font-mono text-ink-3 mt-1 w-6 shrink-0">
                    #{i + 1}
                  </span>
                  <AgentIcon name={tpl?.icon ?? "Bot"} wrapperClassName="size-9" size={14} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">
                      <span className="text-brand-blue-2">{tpl?.name ?? step.agent_slug}</span>{" "}
                      <span className="text-ink-3 text-xs">· {tpl?.role}</span>
                    </div>
                    <div className="text-xs text-ink-2 mt-1 leading-relaxed">{step.action}</div>
                    {step.depends_on && step.depends_on.length > 0 && (
                      <div className="text-[10px] text-ink-3 mt-1.5 font-mono">
                        dépend de : {step.depends_on.join(", ")}
                      </div>
                    )}
                    {out?.text && (
                      <div className="mt-3 rounded-md bg-bg border border-line p-2.5 text-xs text-ink whitespace-pre-wrap leading-relaxed">
                        {out.text.slice(0, 800)}
                        {out.text.length > 800 && "…"}
                      </div>
                    )}
                    {out?.error && (
                      <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
                        {out.error}
                      </div>
                    )}
                  </div>
                  <StatusIcon
                    className={cn(
                      "size-4 shrink-0 mt-1",
                      statusColor,
                      out?.status === "running" && "animate-spin",
                    )}
                  />
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {outcome && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              {outcome.status === "succeeded" ? (
                <CheckCircle2 className="size-5 text-brand-green" />
              ) : (
                <XCircle className="size-5 text-destructive" />
              )}
              Exécution {outcome.status === "succeeded" ? "réussie" : "échouée"}
            </h3>
            <div className="text-xs text-ink-2 font-mono">
              {outcome.steps.length} étapes · {outcome.totalToolCalls} appels d'outils
            </div>
            {outcome.error && (
              <div className="text-sm text-destructive">{outcome.error}</div>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium mb-3">Exécutions précédentes</h3>
            <ul className="divide-y divide-line">
              {(history as Array<{ id: string; status: string; createdAt: string; error: string | null }>).slice(0, 10).map(
                (run) => (
                  <li
                    key={run.id}
                    className="py-2.5 flex items-center gap-3 text-sm"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        run.status === "succeeded" ? "bg-brand-green" :
                        run.status === "failed" ? "bg-destructive" : "bg-ink-3",
                      )}
                    />
                    <span className="font-mono text-xs text-ink-3 flex-1">
                      {new Date(run.createdAt).toLocaleString("fr-FR")}
                    </span>
                    <span className="text-xs text-ink-2">{run.status}</span>
                    {run.error && (
                      <span className="text-xs text-destructive truncate max-w-xs">
                        {run.error}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
