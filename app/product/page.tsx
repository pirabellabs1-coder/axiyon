import { Network, Brain, Shield, Plug, Mic, Cloud } from "lucide-react";

import { auth } from "@/auth";
import { MarketingNav } from "@/components/nav";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Produit" };

const PILLARS = [
  {
    Icon: Network,
    title: "Orchestration multi-agents",
    desc: "Vos agents collaborent comme une équipe. Workflows déclaratifs (YAML), handoffs typés, replay 90 jours.",
  },
  {
    Icon: Brain,
    title: "Mémoire d'entreprise",
    desc: "Vector + épisodique + procédural. Vos agents retiennent l'historique de chaque client, chaque décision.",
  },
  {
    Icon: Shield,
    title: "Gouvernance bancaire",
    desc: "RBAC granulaire, budgets en € par jour/tâche, approbations à seuil, audit immuable SHA-256.",
  },
  {
    Icon: Plug,
    title: "1 200+ intégrations",
    desc: "Salesforce, Slack, GitHub, Stripe, Notion. Branchement OAuth en un clic. Données zéro-copie.",
  },
  {
    Icon: Mic,
    title: "Voice & téléphone",
    desc: "Voice clone de votre marque. Latence inférieure à 200 ms. 47 langues.",
  },
  {
    Icon: Cloud,
    title: "Déploiement souverain",
    desc: "SaaS, VPC dédié, ou on-premise. Data-residency EU. Vous gardez le couteau par le manche.",
  },
];

export default async function ProductPage() {
  const session = await auth();
  return (
    <>
      <MarketingNav session={session?.user} />
      <main className="pt-32 pb-24">
        <div className="container-x text-center max-w-3xl mb-16">
          <span className="inline-block text-[13px] font-medium tracking-widest uppercase text-brand-blue-2 mb-4">
            Produit
          </span>
          <h1 className="text-[clamp(40px,7vw,84px)] leading-[1] tracking-[-0.04em] font-medium mb-6">
            L'architecture qui transforme un LLM{" "}
            <span className="font-serif italic">en employé.</span>
          </h1>
          <p className="text-lg text-ink-2">
            Six piliers, zéro boîte noire. Tout est inspectable, exportable, rejouable.
          </p>
        </div>

        <div className="container-x">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PILLARS.map((p) => (
              <Card key={p.title} className="hover:border-brand-blue transition-colors group">
                <CardContent className="p-7">
                  <div className="size-12 rounded-xl bg-grad shadow-glow flex items-center justify-center mb-5">
                    <p.Icon className="size-6 text-white" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-xl font-medium mb-2">{p.title}</h3>
                  <p className="text-ink-2 leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
