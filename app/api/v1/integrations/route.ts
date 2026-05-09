// V1_FINAL — edge runtime (nodejs runtime hangs on Hobby plan)
import { auth } from "@/auth";

export const runtime = "edge";

export async function GET() {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { listOrgIntegrations } = await import("@/lib/integrations/store");
  const rows = await listOrgIntegrations(session.user.activeOrgId);
  return Response.json(
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
