/**
 * Server-side workflow runner — the execution path for triggers that have no
 * browser (cron sweeps, inbound webhooks).
 *
 * The dashboard runs workflows through `runner.ts`, which drives Puter.js in
 * the user's browser. Nothing schedule-driven can reuse that: there is no
 * browser to host Puter when a cron fires. So this runner goes through
 * `runAgent()` (Vercel AI SDK), which means **an LLM API key is required** —
 * `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` on the deployment. Without one,
 * `runAgent` fails each step with "No LLM provider configured" and the run is
 * recorded as failed rather than silently doing nothing.
 *
 * Step output is shaped exactly like the client runner's `WorkflowStepOutput`
 * so /dashboard/workflows renders a scheduled run and a manual run the same
 * way, and the two paths stay comparable when debugging.
 */
import { eq } from "drizzle-orm";

import { db, agentInstances, workflowRuns } from "@/lib/db";
import { getTemplate } from "@/lib/agents/catalog";
import { runAgent } from "@/lib/agents/runtime";
import { audit } from "@/lib/audit";
import { topoSort, WorkflowGraphError } from "./topo";
import type { WorkflowSpec, WorkflowStepOutput } from "./types";

export interface ServerRunArgs {
  orgId: string;
  workflowId: string;
  slug: string;
  spec: WorkflowSpec;
  inputs?: Record<string, unknown>;
  /** Provenance recorded on the run: "schedule", "webhook", "manual", ... */
  triggeredBy: string;
}

export interface ServerRunOutcome {
  runId: string;
  status: "succeeded" | "failed";
  steps: WorkflowStepOutput[];
  costEur: number;
  error?: string;
}

export async function runWorkflowServerSide(args: ServerRunArgs): Promise<ServerRunOutcome> {
  const startedAt = new Date();

  // Record the run as `running` before doing any work. A function timeout or a
  // crash then leaves a visible in-flight row instead of no trace at all.
  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowId: args.workflowId,
      orgId: args.orgId,
      status: "running",
      inputs: args.inputs ?? {},
      triggeredBy: args.triggeredBy,
      startedAt,
    })
    .returning();

  const finish = async (
    status: "succeeded" | "failed",
    steps: WorkflowStepOutput[],
    costEur: number,
    error?: string,
  ): Promise<ServerRunOutcome> => {
    await db
      .update(workflowRuns)
      .set({
        status,
        outputs: Object.fromEntries(steps.map((s) => [s.id, s])),
        costEur,
        error,
        finishedAt: new Date(),
      })
      .where(eq(workflowRuns.id, run.id));

    await audit({
      orgId: args.orgId,
      actorType: "system",
      actorId: args.triggeredBy,
      action: status === "succeeded" ? "workflow.run.succeeded" : "workflow.run.failed",
      resourceType: "workflow_run",
      resourceId: run.id,
      payload: { slug: args.slug, steps: steps.length, cost_eur: costEur, error },
    }).catch(() => undefined);

    return { runId: run.id, status, steps, costEur, error };
  };

  let order: string[];
  try {
    order = topoSort(args.spec.steps ?? []);
  } catch (e) {
    const msg = e instanceof WorkflowGraphError ? e.message : "Graphe de workflow invalide";
    return finish("failed", [], 0, msg);
  }

  if (!order.length) {
    return finish("failed", [], 0, "Ce workflow n'a aucune étape.");
  }

  // One lookup for the whole run: every step resolves its agent from this list.
  const instances = await db.query.agentInstances.findMany({
    where: eq(agentInstances.orgId, args.orgId),
  });

  const steps: WorkflowStepOutput[] = [];
  const byId = new Map(args.spec.steps.map((s) => [s.id, s]));
  const results: Record<string, WorkflowStepOutput> = {};
  let costEur = 0;

  for (const stepId of order) {
    const step = byId.get(stepId)!;
    const stepStartedAt = new Date().toISOString();

    const push = (partial: Omit<WorkflowStepOutput, "id" | "agent_slug" | "startedAt">) => {
      const out: WorkflowStepOutput = {
        id: stepId,
        agent_slug: step.agent_slug,
        startedAt: stepStartedAt,
        finishedAt: new Date().toISOString(),
        ...partial,
      };
      results[stepId] = out;
      steps.push(out);
      return out;
    };

    const template = getTemplate(step.agent_slug);
    if (!template) {
      push({ status: "failed", error: `Modèle d'agent introuvable : ${step.agent_slug}` });
      return finish("failed", steps, costEur, `Étape "${stepId}" : modèle d'agent inconnu.`);
    }

    // Server-side execution needs a persisted agent, because runAgent attributes
    // the task, cost and audit trail to a real instance. The client runner can
    // fall back to a transient id; here a missing agent is a hard stop with an
    // actionable message rather than a silent skip.
    const instance = instances.find((a) => a.templateSlug === step.agent_slug);
    if (!instance) {
      push({
        status: "failed",
        error:
          `Aucun agent "${template.name}" (${step.agent_slug}) n'est recruté dans cette ` +
          `organisation. Recrute-le depuis /dashboard/agents/hire pour que ce workflow ` +
          `puisse tourner sans navigateur.`,
      });
      return finish(
        "failed",
        steps,
        costEur,
        `Étape "${stepId}" : agent ${step.agent_slug} non recruté.`,
      );
    }

    // Thread upstream results into the objective, matching the client runner's
    // context shape and 1500-char cap per dependency.
    const context = (step.depends_on ?? []).reduce<Record<string, string>>((acc, dep) => {
      const text = results[dep]?.text;
      if (text) acc[dep] = text.slice(0, 1500);
      return acc;
    }, {});

    const objective = Object.keys(context).length
      ? `${step.action}\n\nContexte des étapes précédentes :\n${JSON.stringify(context, null, 2)}`
      : step.action;

    try {
      const r = await runAgent({
        agentId: instance.id,
        orgId: args.orgId,
        objective,
        inputs: args.inputs ?? {},
        policy: "balanced",
      });

      costEur += r.costEur;

      if (r.status === "failed") {
        push({ status: "failed", error: r.error ?? "Échec de l'agent", toolCalls: r.toolCalls });
        return finish("failed", steps, costEur, `Étape "${stepId}" : ${r.error ?? "échec"}`);
      }

      push({ status: "succeeded", text: r.text, toolCalls: r.toolCalls });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push({ status: "failed", error: msg });
      return finish("failed", steps, costEur, `Étape "${stepId}" : ${msg}`);
    }
  }

  return finish("succeeded", steps, costEur);
}
