// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/** Persists a workflow run (called by the client-side runner). */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db, workflowRuns, workflows } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({
  inputs: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled", "awaiting_approval"])
    .default("succeeded"),
  outputs: z.record(z.string(), z.unknown()).default({}),
  error: z.string().nullable().default(null),
  costEur: z.number().default(0),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.user.activeOrgId;
  const { slug } = await ctx.params;

  const wf = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.orgId, orgId), eq(workflows.slug, slug)))
    .orderBy(desc(workflows.version))
    .limit(1);
  if (!wf[0]) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowId: wf[0].id,
      orgId,
      status: body.status,
      inputs: body.inputs,
      outputs: body.outputs,
      costEur: body.costEur,
      error: body.error,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : new Date(),
      triggeredBy: session.user.id,
    })
    .returning();

  await audit({
    orgId,
    actorType: "user",
    actorId: session.user.id,
    action: "workflow.run",
    resourceType: "workflow_run",
    resourceId: run.id,
    payload: { slug, status: body.status },
  }).catch(() => undefined);

  return NextResponse.json({ runId: run.id, status: run.status });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.user.activeOrgId;
  const { slug } = await ctx.params;

  const wf = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.orgId, orgId), eq(workflows.slug, slug)))
    .orderBy(desc(workflows.version))
    .limit(1);
  if (!wf[0]) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, wf[0].id))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(50);

  return NextResponse.json(runs);
}
