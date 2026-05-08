/**
 * Persists the result of a Puter-driven client-side run as a Task row.
 * Cost is 0 (Puter is free for the platform).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { agentInstances, db, tasks } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ingestMemory } from "@/lib/memory";
import { getTemplate } from "@/lib/agents/catalog";

const Body = z.object({
  objective: z.string().min(1).max(8000),
  inputs: z.record(z.string(), z.unknown()).default({}),
  text: z.string().default(""),
  toolCalls: z.array(z.unknown()).default([]),
  modelUsed: z.string().default(""),
  steps: z.number().int().min(0).default(0),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const agent = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, id),
  });
  if (!agent || agent.orgId !== session.user.activeOrgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const now = new Date();
  const [task] = await db
    .insert(tasks)
    .values({
      orgId: session.user.activeOrgId,
      agentId: agent.id,
      objective: body.objective,
      inputPayload: body.inputs,
      outputPayload: { text: body.text, steps: body.steps },
      toolCalls: body.toolCalls,
      status: "succeeded",
      modelUsed: body.modelUsed,
      costEur: 0,
      tokensIn: 0,
      tokensOut: 0,
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
    })
    .returning();

  // Update agent counters
  await db
    .update(agentInstances)
    .set({
      lastRunAt: now,
      tasksToday: (agent.tasksToday ?? 0) + 1,
      healthScore: Math.min(1, (agent.healthScore ?? 1) * 0.97 + 0.03),
      updatedAt: now,
    })
    .where(eq(agentInstances.id, agent.id));

  // Memory + audit (best-effort)
  const tpl = getTemplate(agent.templateSlug);
  await ingestMemory({
    orgId: session.user.activeOrgId,
    agentId: agent.id,
    kind: "task",
    content: `[${tpl?.name ?? agent.name}] ${body.objective.slice(0, 200)} — ${body.text.slice(0, 500)}`,
    importance: 0.45,
    source: `agent:${agent.templateSlug}:puter`,
  }).catch(() => undefined);

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "agent",
    actorId: agent.id,
    action: "agent.run.succeeded",
    resourceType: "task",
    resourceId: task.id,
    payload: { template: agent.templateSlug, model: body.modelUsed, tools: body.toolCalls.length },
  }).catch(() => undefined);

  return NextResponse.json({ taskId: task.id, ok: true });
}
