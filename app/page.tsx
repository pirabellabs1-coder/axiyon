import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/nav";
import { TEMPLATES, categoryLabel } from "@/lib/agents/catalog";
import { AgentIcon } from "@/components/agent-icon";
import { MarketingTicker } from "@/components/marketing/ticker";
import { CustomerWall } from "@/components/marketing/customer-wall";
import { Testimonial } from "@/components/marketing/testimonial";
import { FAQ } from "@/components/marketing/faq";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PlatformTabs } from "@/components/marketing/platform-tabs";
import { ROICalculator } from "@/components/marketing/roi-calculator";

export default async function HomePage() {
  const session = await auth();

  return (
    <>
      <MarketingNav session={session?.user} />

      {/* HERO */}
      <section className="relative overflow-hidden pt-40 pb-24">
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(900px 500px at 20% 0%, rgba(91,108,255,.18), transparent 60%)," +
              "radial-gradient(700px 400px at 90% 30%, rgba(34,211,238,.12), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px)," +
              "linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 50%, #000 30%, transparent 70%)",
          }}
        />
        <div className="container-x text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-2 px-3.5 py-1.5 text-xs text-ink-2 mb-8">
            <span className="size-1.5 rounded-full bg-brand-green shadow-[0_0_12px_#34D399]" />
            Série A · 38 M$ · menée par Sequoia · Mai 2026
          </span>
          <h1 className="text-[clamp(44px,8vw,96px)] leading-[.96] tracking-[-0.04em] font-medium mb-7">
            L'OS de l'entreprise{" "}
            <span className="font-serif italic text-ink-2 block">autonome.</span>
          </h1>
          <p className="text-[clamp(18px,2.2vw,22px)] text-ink-2 max-w-2xl mx-auto mb-10 leading-snug">
            Axion donne à votre entreprise une équipe d'employés IA — vente,
            support, finance, opérations, ingénierie. Recrutez en 60 secondes.
            Mesurés en résultats.
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap mb-16">
            <Button asChild variant="glow" size="lg">
              <Link href="/signup">
                Recruter mon premier agent <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/agents">Voir le catalogue</Link>
            </Button>
          </div>

          <div className="flex gap-12 justify-center flex-wrap pt-12 border-t border-line text-ink-3 text-sm">
            <div>
              <strong className="text-ink font-medium">{TEMPLATES.length}+</strong> agents prêts
            </div>
            <div>
              <strong className="text-ink font-medium">1 200+</strong> intégrations
            </div>
            <div>
              <strong className="text-ink font-medium">SOC 2 · ISO 27001 · HIPAA</strong>
            </div>
            <div>
              <strong className="text-ink font-medium">99,98%</strong> uptime
            </div>
          </div>
        </div>
      </section>

      <MarketingTicker />

      <section className="py-24">
        <div className="container-x">
          <div className="mb-14 max-w-3xl">
            <span className="inline-block text-[13px] font-medium tracking-widest uppercase text-brand-blue-2 mb-4">
              Catalogue · {TEMPLATES.length}+ agents
            </span>
            <h2 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.03em] font-medium mb-5">
              Recrutez l'employé IA dont vous avez besoin.{" "}
              <span className="font-serif italic">Aujourd'hui.</span>
            </h2>
            <p className="text-lg text-ink-2 leading-snug">
              Chaque agent Axion est entraîné sur dix ans de meilleures pratiques
              de son métier, intégré nativement à vos outils, et mesuré sur des
              résultats — pas des heures.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-px bg-line border border-line rounded-xl overflow-hidden">
            {TEMPLATES.slice(0, 8).map((tpl) => (
              <Link
                key={tpl.slug}
                href="/agents"
                className="bg-bg p-7 hover:bg-bg-2 transition-colors group block"
              >
                <AgentIcon name={tpl.icon} wrapperClassName="size-11 mb-5" />
                <div className="font-medium mb-1.5 leading-tight">
                  <span className="text-brand-blue-2">{tpl.name}</span>{" "}
                  · <span className="text-ink-2 text-sm">{tpl.role}</span>
                </div>
                <div className="text-sm text-ink-2 leading-relaxed mb-4">{tpl.description}</div>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.skills.slice(0, 3).map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-xs text-ink-3">
                  <span>{categoryLabel(tpl.category)}</span>
                  <span className="font-mono text-ink">{tpl.priceEurMonthly} €/mois</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button asChild variant="ghost">
              <Link href="/agents">
                Voir les {TEMPLATES.length}+ agents <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PlatformTabs />
      <HowItWorks />
      <CustomerWall />
      <Testimonial />
      <ROICalculator />
      <FAQ />

      <section className="py-32 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(900px 500px at 50% 50%, rgba(91,108,255,.15), transparent 60%)",
          }}
        />
        <div className="container-x max-w-3xl">
          <h2 className="text-[clamp(40px,6vw,72px)] leading-[1] tracking-[-0.03em] font-medium mb-6">
            Vos concurrents ont déjà recruté.
            <br />
            <span className="font-serif italic">Vous, encore ?</span>
          </h2>
          <p className="text-ink-2 text-lg mb-10">
            Compte gratuit. Pas de CB. Premier agent en 60 secondes.
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap">
            <Button asChild variant="glow" size="lg">
              <Link href="/signup">
                Démarrer maintenant <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/manifesto">Lire le manifesto</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-line text-center text-xs text-ink-3 space-x-3">
        <span>© 2026 Axion Labs SAS · Paris</span>
        <span>·</span>
        <a href="mailto:contact@axion.ai" className="hover:text-ink">contact@axion.ai</a>
      </footer>
    </>
  );
}
