/**
 * Agent runtime — executes an agent against an objective using AI SDK.
 *
 * Uses `generateText` with `maxSteps` so the model can call tools in a loop
 * (ReAct-style). Persists token + cost + tool-call trace to `tasks`.
 */
import { generateText, type CoreMessage } from "ai";
import { eq } from "drizzle-orm";

import {
  agentInstances,
  db,
  tasks,
  type AgentInstance,
  type Task,
} from "@/lib/db";
import { audit } from "@/lib/audit";
import { getTemplate } from "@/lib/agents/catalog";
import { selectTools, type ToolName } from "@/lib/agents/tools";
import { estimateCostEur, hasAnyProvider, pickModel, type RoutingPolicy } from "@/lib/llm/router";
import { ingestMemory } from "@/lib/memory";

export interface RunArgs {
  agentId: string;
  orgId: string;
  objective: string;
  inputs?: Record<string, unknown>;
  triggeredByUserId?: string;
  policy?: RoutingPolicy;
}

export interface RunResult {
  taskId: string;
  status: "succeeded" | "failed";
  text: string;
  toolCalls: Array<{ name: string; args: unknown; result?: unknown; error?: string }>;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
  modelUsed: string | null;
  error?: string;
}

/**
 * Run an agent against an objective. Synchronous (resolves when done).
 * Suitable for dashboard "Run now" buttons. For long-running agents use
 * the streaming variant in `runtime/stream.ts`.
 */
export async function runAgent(args: RunArgs): Promise<RunResult> {
  const startedAt = new Date();

  // Load + verify ownership
  const agent: AgentInstance | undefined = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, args.agentId),
  });
  if (!agent || agent.orgId !== args.orgId) {
    throw new Error("Agent not found or not in your organization");
  }

  const template = getTemplate(agent.templateSlug);
  if (!template) {
    throw new Error(`Unknown agent template: ${agent.templateSlug}`);
  }

  // Persist a queued Task
  const [task] = await db
    .insert(tasks)
    .values({
      orgId: args.orgId,
      agentId: agent.id,
      objective: args.objective,
      inputPayload: args.inputs ?? {},
      status: "running",
      startedAt,
    })
    .returning();

  // Build system prompt with custom override + memory hint
  const systemPrompt = agent.customPrompt?.trim() || template.systemPrompt;

  // Pick which tools the agent can use
  const enabled =
    (agent.enabledTools as string[] | null)?.filter(Boolean) ??
    template.defaultTools;
  const toolset = selectTools(enabled);

  // Ensure we have a provider
  if (!hasAnyProvider()) {
    await db
      .update(tasks)
      .set({
        status: "failed",
        error:
          "No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your project's environment.",
        finishedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
    return {
      taskId: task.id,
      status: "failed",
      text: "",
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      costEur: 0,
      modelUsed: null,
      error: "No LLM provider configured",
    };
  }

  const model = pickModel(args.policy ?? "balanced");

  const messages: CoreMessage[] = [
    {
      role: "user",
      content: buildUserMessage(args.objective, args.inputs ?? {}, agent.config ?? {}),
    },
  ];

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools: toolset,
      maxSteps: 8,
      experimental_telemetry: { isEnabled: true, functionId: `agent.${template.slug}` },
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "LLM call failed";
    await db
      .update(tasks)
      .set({
        status: "failed",
        error,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      })
      .where(eq(tasks.id, task.id));
    await db
      .update(agentInstances)
      .set({ status: "error", healthScore: Math.max(0, (agent.healthScore ?? 1) - 0.05) })
      .where(eq(agentInstances.id, agent.id));
    return {
      taskId: task.id,
      status: "failed",
      text: "",
      toolCalls: [],
      tokensIn: 0,
      tokensOut: 0,
      costEur: 0,
      modelUsed: null,
      error,
    };
  }

  // Aggregate tool calls across steps
  const toolCalls = result.steps.flatMap((s) =>
    s.toolCalls.map((tc) => ({
      name: tc.toolName,
      args: tc.args,
      result: s.toolResults.find((tr) => tr.toolCallId === tc.toolCallId)?.result,
    })),
  );

  const tokensIn = result.usage.promptTokens ?? 0;
  const tokensOut = result.usage.completionTokens ?? 0;
  const modelId = result.response.modelId ?? "unknown";
  const costEur = estimateCostEur(modelId, tokensIn, tokensOut);

  // Persist outcome
  const finishedAt = new Date();
  await db
    .update(tasks)
    .set({
      status: "succeeded",
      outputPayload: { text: result.text, finishReason: result.finishReason },
      toolCalls,
      tokensIn,
      tokensOut,
      costEur,
      modelUsed: modelId,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    })
    .where(eq(tasks.id, task.id));

  await db
    .update(agentInstances)
    .set({
      status: "idle",
      lastRunAt: finishedAt,
      tasksToday: (agent.tasksToday ?? 0) + 1,
      healthScore: Math.min(1, (agent.healthScore ?? 1) * 0.97 + 0.03),
    })
    .where(eq(agentInstances.id, agent.id));

  // Persist a memory entry summarising the run
  await ingestMemory({
    orgId: args.orgId,
    agentId: agent.id,
    kind: "task",
    content: `[${template.name}] ${args.objective.slice(0, 200)} — ${result.text.slice(0, 500)}`,
    importance: 0.45,
    source: `agent:${template.slug}`,
  }).catch(() => undefined);

  // Audit
  await audit({
    orgId: args.orgId,
    actorType: "agent",
    actorId: agent.id,
    action: "agent.run.succeeded",
    resourceType: "task",
    resourceId: task.id,
    payload: {
      template: template.slug,
      tokens: tokensIn + tokensOut,
      cost_eur: costEur,
      tool_calls: toolCalls.length,
    },
  }).catch(() => undefined);

  return {
    taskId: task.id,
    status: "succeeded",
    text: result.text,
    toolCalls,
    tokensIn,
    tokensOut,
    costEur,
    modelUsed: modelId,
  };
}

function buildUserMessage(
  objective: string,
  inputs: Record<string, unknown>,
  config: Record<string, unknown>,
): string {
  const lines = [`Objective:\n${objective}\n`];
  if (Object.keys(inputs).length) {
    lines.push(`Inputs:\n${JSON.stringify(inputs, null, 2)}`);
  }
  if (Object.keys(config).length) {
    lines.push(`Agent config:\n${JSON.stringify(config, null, 2)}`);
  }
  lines.push(
    "Plan briefly, call any tools you need, then respond with the final result. " +
      "If a step needs human approval (>5k EUR action, contract signature, mass email), STOP and request approval.",
  );
  return lines.join("\n");
}
