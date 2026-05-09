// V1_FINAL — confirm a password reset using a valid token
import { z } from "zod";

export const runtime = "edge";

const Body = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(10).max(128),
});

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 422 });
  }

  const [{ verifyResetToken }, { default: bcrypt }, { eq }, { db, users }, { audit }] =
    await Promise.all([
      import("@/lib/auth/reset-token"),
      import("bcryptjs"),
      import("drizzle-orm"),
      import("@/lib/db"),
      import("@/lib/audit"),
    ]);

  const v = await verifyResetToken(body.token);
  if (!v.ok || !v.userId) {
    return Response.json(
      { error: `Lien invalide ou expiré (${v.reason ?? "?"})` },
      { status: 400 },
    );
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, v.userId) });
  if (!user) return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, v.userId));

  // Audit (org scope unknown here — find first org membership for trace)
  const { orgMembers } = await import("@/lib/db");
  const m = await db.query.orgMembers.findFirst({ where: eq(orgMembers.userId, v.userId) });
  if (m) {
    await audit({
      orgId: m.orgId,
      actorType: "user",
      actorId: v.userId,
      action: "password.reset",
      resourceType: "user",
      resourceId: v.userId,
    }).catch(() => undefined);
  }

  return Response.json({ ok: true });
}
