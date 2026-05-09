// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { audit } from "@/lib/audit";

const Update = z.object({
  name: z.string().min(1).max(64).optional(),
  customPrompt: z.string().max(8000).nullable().optional(),
  budgetPerDayEur: z.number().int().min(0).max(100_000).optional(),
  enabledTools: z.array(z.string()).optional(),
  status: z.enum(["idle", "running", "paused", "error", "archived"]).optional(),
});

async function loadOwned(id: string, orgId: string | null) {
  if (!orgId) return null;
  const a = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, id),
  });
  return a && a.orgId === orgId ? a : null;
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await ctx.params;
  const a = await loadOwned(id, session?.user.activeOrgId ?? null);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(a);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const a = await loadOwned(id, session.user.activeOrgId);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof Update>;
  try {
    body = Update.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const [updated] = await db
    .update(agentInstances)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(agentInstances.id, id))
    .returning();

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "agent.update",
    resourceType: "agent_instance",
    resourceId: id,
    payload: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "owner"].includes(session.user.activeOrgRole ?? ""))
    return NextResponse.json({ error: "Need admin role" }, { status: 403 });

  const { id } = await ctx.params;
  const a = await loadOwned(id, session.user.activeOrgId);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(agentInstances).where(eq(agentInstances.id, id));
  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "agent.delete",
    resourceType: "agent_instance",
    resourceId: id,
  });
  return new NextResponse(null, { status: 204 });
}
