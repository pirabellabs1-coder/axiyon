// V1_FINAL 1778289461 — production endpoint
/**
 * GET /api/integrations — list current org's connected integrations.
 * (Tokens are NEVER returned; only metadata.)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listOrgIntegrations } from "@/lib/integrations/store";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


export async function GET() {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
