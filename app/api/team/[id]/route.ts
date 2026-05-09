// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { db, orgMembers } from "@/lib/db";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  role: z.enum(["viewer", "operator", "builder", "admin"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "owner"].includes(session.user.activeOrgRole ?? ""))
    return NextResponse.json({ error: "Need admin role" }, { status: 403 });

  const { id } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  // Cannot modify owners
  const existing = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.id, id), eq(orgMembers.orgId, session.user.activeOrgId)),
    )
    .limit(1);
  if (!existing[0])
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (existing[0].role === "owner")
    return NextResponse.json(
      { error: "Cannot change role of org owner" },
      { status: 403 },
    );

  await db
    .update(orgMembers)
    .set({ role: body.role })
    .where(eq(orgMembers.id, id));

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "team.role_change",
    resourceType: "org_member",
    resourceId: id,
    payload: { new_role: body.role },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "owner"].includes(session.user.activeOrgRole ?? ""))
    return NextResponse.json({ error: "Need admin role" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.id, id), eq(orgMembers.orgId, session.user.activeOrgId)),
    )
    .limit(1);
  if (!existing[0])
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (existing[0].role === "owner")
    return NextResponse.json({ error: "Cannot remove org owner" }, { status: 403 });

  await db.delete(orgMembers).where(eq(orgMembers.id, id));

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "team.remove",
    resourceType: "org_member",
    resourceId: id,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
