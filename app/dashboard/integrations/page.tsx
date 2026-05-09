import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listOrgIntegrations } from "@/lib/integrations/store";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    provider?: string;
    missing?: string;
    need?: string;
  }>;
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  const rows = await listOrgIntegrations(session.user.activeOrgId);
  const sp = await searchParams;

  const role = session.user.activeOrgRole ?? "viewer";
  const isAdmin =
    !!session.user.isSuperuser || ["owner", "admin"].includes(role);

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
      flash={{
        connected: sp.connected ?? null,
        error: sp.error ?? null,
        provider: sp.provider ?? null,
        missing: sp.missing ?? null,
        need: sp.need ?? null,
      }}
      isAdmin={isAdmin}
    />
  );
}
