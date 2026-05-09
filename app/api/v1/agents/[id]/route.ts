// V1_FINAL — minimal top-level imports + lazy heavy deps
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const Update = z.object({
  name: z.string().min(1).max(64).optional(),
  customPrompt: z.string().max(8000).nullable().optional(),
  budgetPerDayEur: z.number().int().min(0).max(100_000).optional(),
  enabledTools: z.array(z.string()).optional(),
  status: z.enum(["idle", "running", "paused", "error", "archived"]).optional(),
});

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await ctx.params;
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ eq }, dbMod] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
  ]);
  const { db, agentInstances } = dbMod;
  const a = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, id),
  });
  if (!a || a.orgId !== session.user.activeOrgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(a);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let body: z.infer<typeof Update>;
  try {
    body = Update.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const [{ eq }, dbMod, audMod] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/audit"),
  ]);
  const { db, agentInstances } = dbMod;
  const { audit } = audMod;

  const a = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, id),
  });
  if (!a || a.orgId !== session.user.activeOrgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "owner"].includes(session.user.activeOrgRole ?? ""))
    return NextResponse.json({ error: "Need admin role" }, { status: 403 });

  const { id } = await ctx.params;
  const [{ eq }, dbMod, audMod] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/audit"),
  ]);
  const { db, agentInstances } = dbMod;
  const { audit } = audMod;

  const a = await db.query.agentInstances.findFirst({
    where: eq(agentInstances.id, id),
  });
  if (!a || a.orgId !== session.user.activeOrgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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
