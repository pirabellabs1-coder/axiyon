/**
 * Client-side workflow runner.
 *
 * Topologically sorts the steps, then executes each via the per-agent
 * client runtime (Puter). Streams progress to a callback. On finish,
 * persists the run via POST /api/workflows/[slug]/runs.
 */
import { runWithPuter } from "@/lib/agents/puter-runtime";
import { CATALOG } from "@/lib/agents/catalog";
import type {
  WorkflowSpec,
  WorkflowStepOutput,
  WorkflowStepSpec,
} from "./types";

interface RunCallbacks {
  onStepStart?: (stepId: string) => void;
  onStepProgress?: (stepId: string, partial: { text?: string; toolCall?: unknown }) => void;
  onStepFinish?: (step: WorkflowStepOutput) => void;
}

export interface RunOutcome {
  status: "succeeded" | "failed";
  steps: WorkflowStepOutput[];
  totalToolCalls: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export async function runWorkflow(
  slug: string,
  spec: WorkflowSpec,
  inputs: Record<string, unknown>,
  agentInstances: Array<{ id: string; templateSlug: string; enabledTools: string[]; customPrompt: string | null }>,
  callbacks: RunCallbacks = {},
): Promise<RunOutcome> {
  const order = topoSort(spec.steps);
  const startedAt = new Date().toISOString();

  const results: Record<string, WorkflowStepOutput> = {};
  const stepOutputs: WorkflowStepOutput[] = [];
  let failed = false;
  let totalToolCalls = 0;

  for (const stepId of order) {
    const step = spec.steps.find((s) => s.id === stepId)!;
    callbacks.onStepStart?.(stepId);

    const stepStartedAt = new Date().toISOString();
    const tpl = CATALOG[step.agent_slug];
    if (!tpl) {
      const out: WorkflowStepOutput = {
        id: stepId,
        agent_slug: step.agent_slug,
        status: "failed",
        error: `Agent introuvable : ${step.agent_slug}`,
        startedAt: stepStartedAt,
        finishedAt: new Date().toISOString(),
      };
      results[stepId] = out;
      stepOutputs.push(out);
      callbacks.onStepFinish?.(out);
      failed = true;
      break;
    }

    // Find an existing agent instance for this template, fallback to a transient one.
    const inst = agentInstances.find((a) => a.templateSlug === step.agent_slug);

    // Build the objective with previous step outputs in context
    const ctx = step.depends_on?.reduce<Record<string, string>>((acc, dep) => {
      const out = results[dep];
      if (out?.text) acc[dep] = out.text.slice(0, 1500);
      return acc;
    }, {});

    const objective = ctx && Object.keys(ctx).length
      ? `${step.action}\n\nContexte des étapes précédentes :\n${JSON.stringify(ctx, null, 2)}`
      : step.action;

    try {
      const r = await runWithPuter({
        agentId: inst?.id ?? `transient-${step.agent_slug}`,
        templateSlug: step.agent_slug,
        systemPrompt: inst?.customPrompt?.trim() || tpl.systemPrompt,
        enabledTools: inst?.enabledTools?.length ? inst.enabledTools : tpl.defaultTools,
        objective,
        inputs,
        onText: (chunk) => callbacks.onStepProgress?.(stepId, { text: chunk }),
        onToolCall: (call) => callbacks.onStepProgress?.(stepId, { toolCall: call }),
      });
      const out: WorkflowStepOutput = {
        id: stepId,
        agent_slug: step.agent_slug,
        status: "succeeded",
        text: r.text,
        toolCalls: r.toolCalls,
        startedAt: stepStartedAt,
        finishedAt: new Date().toISOString(),
      };
      totalToolCalls += r.toolCalls.length;
      results[stepId] = out;
      stepOutputs.push(out);
      callbacks.onStepFinish?.(out);
    } catch (e) {
      const out: WorkflowStepOutput = {
        id: stepId,
        agent_slug: step.agent_slug,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
        startedAt: stepStartedAt,
        finishedAt: new Date().toISOString(),
      };
      results[stepId] = out;
      stepOutputs.push(out);
      callbacks.onStepFinish?.(out);
      failed = true;
      break;
    }
  }

  const finishedAt = new Date().toISOString();

  // Persist the run
  await fetch(`/api/workflows/${encodeURIComponent(slug)}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs,
      status: failed ? "failed" : "succeeded",
      outputs: results,
      costEur: 0,
      startedAt,
      finishedAt,
    }),
  }).catch(() => undefined);

  return {
    status: failed ? "failed" : "succeeded",
    steps: stepOutputs,
    totalToolCalls,
    startedAt,
    finishedAt,
  };
}

function topoSort(steps: WorkflowStepSpec[]): string[] {
  const deps = new Map<string, Set<string>>();
  for (const s of steps) deps.set(s.id, new Set(s.depends_on ?? []));
  const ready: string[] = steps.filter((s) => !s.depends_on?.length).map((s) => s.id);
  const order: string[] = [];
  while (ready.length) {
    const n = ready.shift()!;
    order.push(n);
    for (const s of steps) {
      if (deps.get(s.id)?.has(n)) {
        deps.get(s.id)!.delete(n);
        if (deps.get(s.id)!.size === 0 && !order.includes(s.id) && !ready.includes(s.id)) {
          ready.push(s.id);
        }
      }
    }
  }
  if (order.length !== steps.length) {
    throw new Error("Cycle détecté dans le workflow");
  }
  return order;
}
