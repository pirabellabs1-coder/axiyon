import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db, orgs } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { hasAnyProvider } from "@/lib/llm/router";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  const org = await db.query.orgs.findFirst({
    where: eq(orgs.id, session.user.activeOrgId),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Paramètres</h1>
        <p className="text-ink-2 mt-1">Compte, organisation, intégrations.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-medium">Compte</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV label="Nom" value={session.user.name ?? "—"} />
            <KV label="Email" value={session.user.email ?? "—"} />
            <KV label="Rôle (org)" value={session.user.activeOrgRole ?? "—"} />
            <KV label="Super-admin" value={session.user.isSuperuser ? "✓" : "—"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-medium">Organisation</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV label="Nom" value={org?.name ?? "—"} />
            <KV label="Slug" value={org?.slug ?? "—"} />
            <KV label="Plan" value={org?.tier ?? "solo"} />
            <KV label="Région" value={org?.region ?? "—"} />
            <KV label="Tâches/mois" value={(org?.taskQuotaMonthly ?? 0).toLocaleString("fr-FR")} />
            <KV label="Budget/mois" value={`${org?.budgetEurMonthly ?? 0} €`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-medium">Système IA</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV
              label="Anthropic"
              value={process.env.ANTHROPIC_API_KEY ? "✓ configuré" : "✗ absent"}
            />
            <KV
              label="OpenAI"
              value={process.env.OPENAI_API_KEY ? "✓ configuré" : "✗ absent"}
            />
            <KV
              label="Provider actif"
              value={hasAnyProvider() ? "✓ oui" : "✗ aucun"}
            />
          </div>
          {!hasAnyProvider() && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-200">
              Aucun provider LLM n'est configuré. Ajoutez{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span> ou{" "}
              <span className="font-mono">OPENAI_API_KEY</span> dans Vercel → Project →
              Environment Variables pour faire tourner les agents en production.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 font-mono">{label}</div>
      <div className="text-ink mt-0.5">{value}</div>
    </div>
  );
}
