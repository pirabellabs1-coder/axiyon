"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { runWorkflow } from "@/lib/workflows/runner";
import type { WorkflowSpec, WorkflowStepOutput } from "@/lib/workflows/types";
import { AgentIcon } from "@/components/agent-icon";

interface StepMeta {
  id: string;
  agent_slug: string;
  agentName: string;
  agentRole: string;
  icon: string;
  action: string;
  depends_on?: string[];
  hasInstance: boolean;
}

interface AgentInstanceLite {
  id: string;
  templateSlug: string;
  enabledTools: string[];
  customPrompt: string | null;
}

type StepState =
  | { status: "idle" }
  | { status: "running"; partialText: string }
  | { status: "succeeded"; text: string; toolCalls: unknown[] }
  | { status: "failed"; error: string };

export function WorkflowDetailClient({
  slug,
  spec,
  stepsMeta,
  agentInstances,
}: {
  slug: string;
  spec: WorkflowSpec;
  stepsMeta: StepMeta[];
  agentInstances: AgentInstanceLite[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [overall, setOverall] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const initialState: Record<string, StepState> = Object.fromEntries(
    stepsMeta.map((s) => [s.id, { status: "idle" } as StepState]),
  );
  const [stepStates, setStepStates] = useState<Record<string, StepState>>(initialState);

  async function execute() {
    setRunning(true);
    setOverall("running");
    setOutcomeError(null);
    setStepStates(Object.fromEntries(stepsMeta.map((s) => [s.id, { status: "idle" } as StepState])));

    try {
      const outcome = await runWorkflow(slug, spec, {}, agentInstances, {
        onStepStart: (stepId) => {
          setStepStates((prev) => ({ ...prev, [stepId]: { status: "running", partialText: "" } }));
        },
        onStepProgress: (stepId, partial) => {
          if (partial.text) {
            setStepStates((prev) => {
              const cur = prev[stepId];
              const text = cur.status === "running" ? cur.partialText + partial.text : partial.text;
              return { ...prev, [stepId]: { status: "running", partialText: text } };
            });
          }
        },
        onStepFinish: (out: WorkflowStepOutput) => {
          setStepStates((prev) => ({
            ...prev,
            [out.id]:
              out.status === "succeeded"
                ? { status: "succeeded", text: out.text ?? "", toolCalls: out.toolCalls ?? [] }
                : { status: "failed", error: out.error ?? "Erreur inconnue" },
          }));
        },
      });
      setOverall(outcome.status);
      if (outcome.status === "failed") setOutcomeError(outcome.error ?? "Le workflow a échoué.");
      router.refresh();
    } catch (e) {
      setOverall("failed");
      setOutcomeError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-ink-3 font-mono">
          {stepsMeta.length} étapes · {agentInstances.length} agents disponibles
        </div>
        <Button onClick={execute} disabled={running} variant="glow">
          {running ? (
            <>
              <Loader2 className="size-4 animate-spin" /> En cours…
            </>
          ) : (
            <>
              <Play className="size-4" /> Exécuter maintenant
            </>
          )}
        </Button>
      </div>

      <ul className="space-y-2">
        {stepsMeta.map((s) => {
          const state = stepStates[s.id] ?? { status: "idle" };
          return (
            <li
              key={s.id}
              className={
                "rounded-md border p-3 transition-colors " +
                (state.status === "running"
                  ? "border-brand-blue/40 bg-brand-blue/5"
                  : state.status === "succeeded"
                    ? "border-brand-green/30 bg-brand-green/[0.04]"
                    : state.status === "failed"
                      ? "border-brand-red/30 bg-brand-red/5"
                      : "border-line bg-bg-3/40")
              }
            >
              <div className="flex items-start gap-3">
                <StepIcon state={state.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-ink-3 px-1.5 py-0.5 rounded bg-bg">
                      {s.id}
                    </span>
                    <AgentIcon name={s.icon} size={12} wrapperClassName="size-6" />
                    <span className="text-sm font-medium">{s.agentName}</span>
                    <span className="text-xs text-ink-3">· {s.agentRole}</span>
                    {!s.hasInstance && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-brand-yellow/30 bg-brand-yellow/10 text-brand-yellow"
                        title="Cet agent n'est pas encore recruté dans votre org. Le runtime utilisera une instance transitoire."
                      >
                        non recruté
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-2 mt-1.5 whitespace-pre-wrap">{s.action}</p>
                  {s.depends_on && s.depends_on.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-ink-3 font-mono">
                      ↳ après {s.depends_on.join(", ")}
                    </div>
                  )}
                  {state.status === "running" && state.partialText && (
                    <pre className="mt-2 text-xs text-ink-2 whitespace-pre-wrap font-sans bg-bg p-2 rounded border border-line">
                      {state.partialText}
                    </pre>
                  )}
                  {state.status === "succeeded" && state.text && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-brand-green cursor-pointer font-mono">
                        Résultat ({state.toolCalls.length} outils appelés)
                      </summary>
                      <pre className="mt-2 text-xs whitespace-pre-wrap font-sans bg-bg p-2 rounded border border-line">
                        {state.text}
                      </pre>
                    </details>
                  )}
                  {state.status === "failed" && (
                    <div className="mt-2 text-xs text-brand-red font-mono bg-bg p-2 rounded border border-brand-red/30">
                      {state.error}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {overall === "succeeded" && (
        <div className="rounded-md border border-brand-green/30 bg-brand-green/5 p-3 text-sm text-brand-green">
          Workflow terminé avec succès.
        </div>
      )}
      {overall === "failed" && (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/5 p-3 text-sm text-brand-red">
          Workflow échoué{outcomeError ? ` : ${outcomeError}` : "."}
        </div>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: StepState["status"] }) {
  if (state === "running") return <Loader2 className="size-4 animate-spin text-brand-blue mt-0.5" />;
  if (state === "succeeded") return <CheckCircle2 className="size-4 text-brand-green mt-0.5" />;
  if (state === "failed") return <AlertCircle className="size-4 text-brand-red mt-0.5" />;
  return <Clock className="size-4 text-ink-3 mt-0.5" />;
}
