import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listOrgIntegrations } from "@/lib/integrations/store";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  const rows = await listOrgIntegrations(session.user.activeOrgId);

  return (
    <IntegrationsClient
      connected={rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        accountEmail: r.accountEmail,
        accountName: r.accountName,
        status: r.status,
        scopes: r.scopes ?? [],
        connectedAt: r.connectedAt?.toISOString?.() ?? new Date().toISOString(),
        lastUsedAt: r.lastUsedAt?.toISOString?.() ?? null,
      }))}
    />
  );
}
