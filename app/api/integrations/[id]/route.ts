/** DELETE /api/integrations/[id] — disconnect an integration. */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { disconnectIntegration } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await disconnectIntegration(session.user.activeOrgId, id);

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "integration.disconnect",
    resourceType: "integration",
    resourceId: id,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
