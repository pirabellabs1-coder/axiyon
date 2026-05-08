import Link from "next/link";

import { TEMPLATES } from "@/lib/agents/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HirePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-sm text-ink-2 hover:text-ink"
        >
          ← Retour aux agents
        </Link>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Recruter un agent
        </h1>
        <p className="text-ink-2 mt-1">
          Choisissez un profil dans le catalogue. Vous pourrez personnaliser ses
          outils, son budget, et son prompt après.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <Card key={t.slug} className="hover:border-brand-blue transition-colors">
            <CardContent className="p-5 flex flex-col gap-4 h-full">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-bg-3 border border-line flex items-center justify-center text-lg">
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    <span className="text-brand-blue-2">{t.name}</span>{" "}
                    <span className="text-ink-2 text-sm">· {t.role}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-3 font-mono">
                    {t.category}
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink-2 leading-relaxed flex-1">{t.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.skills.slice(0, 4).map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
              <div className="pt-4 border-t border-line flex items-center justify-between">
                <span className="text-xs text-ink-2 font-mono">
                  {t.priceEurMonthly} €/mois
                </span>
                <Button asChild variant="glow" size="sm">
                  <Link href={`/dashboard/agents/hire/${t.slug}`}>Recruter →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
