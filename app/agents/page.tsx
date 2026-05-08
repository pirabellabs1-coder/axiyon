import Link from "next/link";

import { auth } from "@/auth";
import { MarketingNav } from "@/components/nav";
import { TEMPLATES, listCategories } from "@/lib/agents/catalog";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Catalogue d'agents" };

export default async function AgentsCatalogPage() {
  const session = await auth();
  const cats = listCategories();
  return (
    <>
      <MarketingNav session={session?.user} />
      <main className="pt-32 pb-24">
        <div className="container-x text-center max-w-3xl mb-16">
          <span className="inline-block text-[13px] font-medium tracking-widest uppercase text-brand-blue-2 mb-4">
            Catalogue · {TEMPLATES.length} agents prêts
          </span>
          <h1 className="text-[clamp(40px,7vw,84px)] leading-[1] tracking-[-0.04em] font-medium mb-6">
            Recrutez l'employé IA{" "}
            <span className="font-serif italic">qu'il vous faut.</span>
          </h1>
          <p className="text-lg text-ink-2">
            Chaque agent vient avec un cerveau pré-entraîné, un toolkit branché,
            et une mémoire d'organisation. Démarrage en 60 secondes.
          </p>
        </div>

        <div className="container-x">
          <div className="flex gap-2 mb-8 flex-wrap justify-center">
            {cats.map((c) => (
              <span
                key={c}
                className="px-3 py-1.5 rounded-md border border-line bg-bg-2 text-xs text-ink-2 uppercase tracking-wider font-mono"
              >
                {c}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <div key={t.slug} className="card flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-md bg-bg-3 border border-line flex items-center justify-center text-lg">
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      <span className="text-brand-blue-2">{t.name}</span>{" "}
                      <span className="text-sm text-ink-2">· {t.role}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-ink-3">
                      {t.category}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-ink-2 leading-relaxed flex-1">{t.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.skills.map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-ink-2 font-mono">{t.priceEurMonthly} €/mois</span>
                  <span className="text-brand-green font-mono">● Disponible</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Button asChild variant="glow" size="lg">
              <Link href={session ? "/dashboard/agents/hire" : "/signup"}>
                {session ? "Recruter un agent →" : "Créer mon compte →"}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
