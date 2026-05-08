import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { db, orgMembers, users } from "@/lib/db";

const Body = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(["viewer", "operator", "builder", "admin"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "owner"].includes(session.user.activeOrgRole ?? ""))
    return NextResponse.json({ error: "Need admin role" }, { status: 403 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
  if (!user)
    return NextResponse.json(
      { error: "Aucun utilisateur Axion avec cet email. Demandez-lui de créer un compte d'abord." },
      { status: 404 },
    );

  const existing = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, user.id),
        eq(orgMembers.orgId, session.user.activeOrgId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: "Cet utilisateur fait déjà partie de l'organisation" },
      { status: 409 },
    );
  }

  const [row] = await db
    .insert(orgMembers)
    .values({
      userId: user.id,
      orgId: session.user.activeOrgId,
      role: body.role,
    })
    .returning();

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "team.invite",
    resourceType: "org_member",
    resourceId: row.id,
    payload: { invited_user: user.email, role: body.role },
  }).catch(() => undefined);

  return NextResponse.json({ memberId: row.id });
}
