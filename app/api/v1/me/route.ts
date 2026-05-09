// PATCH /api/v1/me — update the signed-in user's profile (name + optional password change).
// Requires the current password when changing the password.
import { z } from "zod";
import { auth } from "@/auth";

export const runtime = "edge";

const Body = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: z.string().min(10).max(128).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return Response.json(
      { error: "Invalid body", detail: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }

  if (!body.name && !body.newPassword) {
    return Response.json({ error: "Rien à mettre à jour" }, { status: 422 });
  }

  const [{ default: bcrypt }, { eq }, { db, users }, { audit }] = await Promise.all([
    import("bcryptjs"),
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/audit"),
  ]);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const updates: { name?: string; passwordHash?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (body.name && body.name !== user.name) {
    updates.name = body.name;
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      return Response.json(
        { error: "Mot de passe actuel requis pour changer le mot de passe" },
        { status: 422 },
      );
    }
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      return Response.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
    }
    updates.passwordHash = await bcrypt.hash(body.newPassword, 12);
  }

  if (Object.keys(updates).length === 1) {
    return Response.json({ ok: true, noChange: true });
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id));

  if (session.user.activeOrgId) {
    await audit({
      orgId: session.user.activeOrgId,
      actorType: "user",
      actorId: session.user.id,
      action: updates.passwordHash ? "user.password.change" : "user.profile.update",
      resourceType: "user",
      resourceId: session.user.id,
      payload: {
        nameChanged: Boolean(updates.name),
        passwordChanged: Boolean(updates.passwordHash),
      },
    }).catch(() => undefined);
  }

  return Response.json({ ok: true });
}
