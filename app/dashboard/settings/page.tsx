import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Check, X, Crown, Minus } from "lucide-react";

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
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-3 font-mono">
                Super-admin
              </div>
              <div className="text-ink mt-0.5 flex items-center gap-1.5">
                {session.user.isSuperuser ? (
                  <>
                    <Crown className="size-4 text-brand-magenta" strokeWidth={2} />
                    <span>Oui</span>
                  </>
                ) : (
                  <>
                    <Minus className="size-4 text-ink-3" strokeWidth={2} />
                    <span>Non</span>
                  </>
                )}
              </div>
            </div>
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
            <KV
              label="Tâches/mois"
              value={(org?.taskQuotaMonthly ?? 0).toLocaleString("fr-FR")}
            />
            <KV label="Budget/mois" value={`${org?.budgetEurMonthly ?? 0} €`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-medium">Système IA</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Status
              label="Anthropic"
              ok={!!process.env.ANTHROPIC_API_KEY}
              okText="configuré"
              koText="absent"
            />
            <Status
              label="OpenAI"
              ok={!!process.env.OPENAI_API_KEY}
              okText="configuré"
              koText="absent"
            />
            <Status
              label="Provider actif"
              ok={hasAnyProvider()}
              okText="oui"
              koText="aucun"
            />
          </div>
          {!hasAnyProvider() && (
            <div className="rounded-md border border-brand-yellow/30 bg-brand-yellow/5 p-3 text-xs text-brand-yellow">
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

function Status({
  label,
  ok,
  okText,
  koText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  koText: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 font-mono">{label}</div>
      <div
        className={`mt-0.5 flex items-center gap-1.5 ${
          ok ? "text-brand-green" : "text-brand-red"
        }`}
      >
        {ok ? <Check className="size-4" strokeWidth={2} /> : <X className="size-4" strokeWidth={2} />}
        <span>{ok ? okText : koText}</span>
      </div>
    </div>
  );
}
