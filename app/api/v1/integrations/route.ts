// V1_FINAL — lazy-load heavy store module
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { listOrgIntegrations } = await import("@/lib/integrations/store");
  const rows = await listOrgIntegrations(session.user.activeOrgId);
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      accountEmail: r.accountEmail,
      accountName: r.accountName,
      status: r.status,
      scopes: r.scopes,
      connectedAt: r.connectedAt,
      lastUsedAt: r.lastUsedAt,
    })),
  );
}
