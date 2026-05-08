import Link from "next/link";
import { auth } from "@/auth";
import { MarketingNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Tarifs" };

const TIERS = [
  {
    name: "Solo",
    pitch: "Pour les fondateurs et indépendants — eux + leur agent.",
    price: "Gratuit",
    period: "à vie",
    features: [
      "Jusqu'à 3 agents",
      "1 000 tâches/mois incluses",
      "Audit immuable SHA-256",
      "Communauté Discord",
    ],
    cta: "Démarrer gratuitement",
    href: "/signup",
    glow: false,
  },
  {
    name: "Growth",
    pitch: "Pour les startups et PMEs qui veulent doubler la production.",
    price: "299 €",
    period: "/ agent / mois",
    features: [
      "Agents illimités",
      "25 000 tâches/mois",
      "Workflows multi-agents",
      "SSO Google + Microsoft",
      "Support 24/7",
    ],
    cta: "Essai 14 jours",
    href: "/signup",
    glow: true,
  },
  {
    name: "Enterprise",
    pitch: "Pour les groupes qui veulent leur propre OS d'agents.",
    price: "Sur devis",
    period: "",
    features: [
      "Tout Growth +",
      "VPC dédié ou on-premise",
      "Agents sur mesure",
      "SLA 99,99% + DPA",
      "CSM dédié",
    ],
    cta: "Parler à un humain",
    href: "mailto:sales@axion.ai",
    glow: false,
  },
];

export default async function PricingPage() {
  const session = await auth();
  return (
    <>
      <MarketingNav session={session?.user} />
      <main className="pt-32 pb-24">
        <div className="container-x text-center max-w-3xl mb-16">
          <span className="inline-block text-[13px] font-medium tracking-widest uppercase text-brand-blue-2 mb-4">
            Tarifs · Mai 2026
          </span>
          <h1 className="text-[clamp(40px,7vw,84px)] leading-[1] tracking-[-0.04em] font-medium mb-6">
            Vous payez le résultat.{" "}
            <span className="font-serif italic">Pas le token.</span>
          </h1>
          <p className="text-lg text-ink-2">
            Forfait par agent + tâches consommées. Annulation en un clic.
          </p>
        </div>

        <div className="container-x">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {TIERS.map((t) => (
              <Card
                key={t.name}
                className={
                  t.glow
                    ? "border-brand-blue shadow-elev relative bg-gradient-to-b from-brand-blue/10 to-bg-2"
                    : ""
                }
              >
                {t.glow && (
                  <div className="absolute -top-3 right-6 px-3 py-0.5 text-[11px] uppercase tracking-wider font-mono bg-brand-blue text-white rounded-full">
                    Le plus choisi
                  </div>
                )}
                <CardContent className="p-8 flex flex-col gap-6">
                  <div>
                    <div className="text-xs uppercase tracking-wider font-mono text-ink-2 mb-2">
                      {t.name}
                    </div>
                    <p className="text-sm text-ink-2">{t.pitch}</p>
                  </div>
                  <div className="border-y border-line py-5">
                    <span className="text-5xl font-medium tracking-tight">{t.price}</span>{" "}
                    <span className="text-sm text-ink-2">{t.period}</span>
                  </div>
                  <ul className="space-y-2 text-sm text-ink-2 flex-1">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-brand-blue">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={t.glow ? "glow" : "ghost"}
                    className="justify-center"
                  >
                    <Link href={t.href}>{t.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
