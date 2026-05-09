// V1_FINAL — lazy-load heavy modules
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { disconnectIntegration } = await import("@/lib/integrations/store");
  const { audit } = await import("@/lib/audit");
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
