import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { runAgent } from "@/lib/agents/runtime";
import { audit } from "@/lib/audit";

export const maxDuration = 60; // seconds — Vercel function timeout

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
