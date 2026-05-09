// Persist a completed agent run (Puter or server-side) as a Task row.
import { z } from "zod";
import { auth } from "@/auth";

export const runtime = "edge";

const Body = z.object({
  objective: z.string().min(1).max(8000),
  inputs: z.record(z.string(), z.unknown()).optional(),
  text: z.string(),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        args: z.unknown(),
        result: z.unknown().optional(),
        error: z.string().optional(),
      }),
    )
    .default([]),
  modelUsed: z.string().optional(),
  steps: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime().optional(),
  costEur: z.number().nonnegative().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.activeOrgId;
  const { id: agentId } = await ctx.params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid body" },
      { status: 422 },
    );
  }

  const [{ eq, sql }, { db, agentInstances, tasks }, { audit }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/audit"),
  ]);

  // Validate the agent belongs to the user's org.
  const agent = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, agentId),
  });
  if (!agent || agent.orgId !== orgId) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date(Date.now() - 1000);
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const status = body.toolCalls.some((tc) => tc.error) ? "failed" : "succeeded";

  const [task] = await db
    .insert(tasks)
    .values({
      orgId,
      agentId,
      objective: body.objective,
      status,
      inputPayload: (body.inputs ?? {}) as Record<string, unknown>,
      outputPayload: { text: body.text } as Record<string, unknown>,
      toolCalls: body.toolCalls as unknown as Record<string, unknown>[],
      durationMs,
      tokensIn: 0,
      tokensOut: 0,
      costEur: body.costEur ?? 0,
      modelUsed: body.modelUsed ?? null,
      error: null,
      startedAt,
      finishedAt,
    })
    .returning();

  // Bump the agent's "last run" + tasksToday counter.
  await db
    .update(agentInstances)
    .set({
      lastRunAt: finishedAt,
      tasksToday: sql`${agentInstances.tasksToday} + 1`,
      updatedAt: finishedAt,
    })
    .where(eq(agentInstances.id, agentId));

  // Audit
  await audit({
    orgId,
    actorType: "agent",
    actorId: agentId,
    action: "agent.run.completed",
    resourceType: "task",
    resourceId: task.id,
    payload: {
      objective: body.objective.slice(0, 200),
      status,
      tools: body.toolCalls.map((t) => t.name),
      steps: body.steps ?? 0,
      modelUsed: body.modelUsed ?? null,
    },
  }).catch(() => undefined);

  return Response.json({ ok: true, taskId: task.id, status });
}
