import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { TEMPLATES, categoryLabel } from "@/lib/agents/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentIcon } from "@/components/agent-icon";

export default function HirePage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="size-3.5" /> Retour aux agents
        </Link>
        <h1 className="text-3xl font-medium tracking-tight mt-3">
          Recruter un agent
        </h1>
        <p className="text-ink-2 mt-1.5">
          Choisissez un profil dans le catalogue. Vous pourrez personnaliser ses outils,
          son budget et son prompt après.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((tpl) => (
          <Card key={tpl.slug} className="hover:border-brand-blue transition-colors group">
            <CardContent className="p-5 flex flex-col gap-4 h-full">
              <div className="flex items-start gap-3">
                <AgentIcon name={tpl.icon} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium leading-tight">
                    <span className="text-brand-blue-2">{tpl.name}</span>{" "}
                    <span className="text-ink-2 text-sm">· {tpl.role}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-3 font-mono mt-1">
                    {categoryLabel(tpl.category)}
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink-2 leading-relaxed flex-1">{tpl.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {tpl.skills.slice(0, 4).map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
              <div className="pt-4 border-t border-line flex items-center justify-between">
                <span className="text-xs text-ink-2 font-mono">{tpl.priceEurMonthly} €/mois</span>
                <Button asChild variant="glow" size="sm">
                  <Link href={`/dashboard/agents/hire/${tpl.slug}`}>
                    Recruter <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
