// MIRRORED_TO_V1 — mirrored from app/api/agents/[id]/run/route.ts
// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { audit } from "@/lib/audit";

// IMPORTANT: do NOT statically import @/lib/agents/runtime — it pulls the
// `ai` SDK and the entire tools graph (~10MB), which co-bundles with sibling
// routes (/api/agents, /api/agents/[id]) in the same lambda and blows past
// the cold-start budget. Lazy-load only when this POST handler actually runs.
export const maxDuration = 60; // seconds — Vercel function timeout
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  objective: z.string().min(1).max(8000),
  inputs: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["operator", "builder", "admin", "owner"].includes(session.user.activeOrgRole ?? "")) {
    return NextResponse.json({ error: "Need operator role" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "agent.run.requested",
    resourceType: "agent_instance",
    resourceId: id,
    payload: { objective: body.objective.slice(0, 200) },
  }).catch(() => undefined);

  try {
    // Lazy import — keeps the heavy `ai` + tools graph out of the lambda
    // cold-start path for sibling routes that share this bundle.
    const { runAgent } = await import("@/lib/agents/runtime");
    const result = await runAgent({
      agentId: id,
      orgId: session.user.activeOrgId,
      objective: body.objective,
      inputs: body.inputs,
      triggeredByUserId: session.user.id,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Run failed" },
      { status: 500 },
    );
  }
}
