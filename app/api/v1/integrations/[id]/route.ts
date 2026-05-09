// V1_FINAL — edge runtime
import { auth } from "@/auth";

export const runtime = "edge";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [{ disconnectIntegration }, { audit }] = await Promise.all([
    import("@/lib/integrations/store"),
    import("@/lib/audit"),
  ]);
  await disconnectIntegration(session.user.activeOrgId, id);

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "integration.disconnect",
    resourceType: "integration",
    resourceId: id,
  }).catch(() => undefined);

  return Response.json({ ok: true });
}
