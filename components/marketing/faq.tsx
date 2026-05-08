"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const QA = [
  {
    q: "Est-ce qu'Axion remplace mes employés ?",
    a: "Non — sauf si c'est ce que vous voulez. La plupart de nos clients utilisent Axion pour absorber la croissance sans recruter. Vos meilleurs employés deviennent des chefs d'orchestre d'agents, pas des exécutants.",
  },
  {
    q: "Et si l'agent fait une bêtise ?",
    a: "Tout est journalisé, signé cryptographiquement, rejouable jusqu'à 90 jours. Vous pouvez time-traveler l'état du système. Et chaque agent a un budget d'action que vous fixez.",
  },
  {
    q: "Quelle est la différence avec ChatGPT ou Claude ?",
    a: "Un LLM est un cerveau. Axion est un employé : il a une mémoire de votre entreprise, des outils branchés, des permissions, un manager (vous), des objectifs mesurables. Et il travaille en équipe avec d'autres agents.",
  },
  {
    q: "Mes données partent-elles dans un modèle ?",
    a: "Jamais. Vos données restent dans votre tenant, chiffrées AES-256 au repos, mTLS en transit. Aucun modèle n'est entraîné sur vos données. Mode VPC dédié et on-premise disponibles.",
  },
  {
    q: "Combien de temps pour voir un retour ?",
    a: "Médiane sur nos clients : 9 jours pour le break-even sur le premier agent. ROI moyen 14× sur 6 mois.",
  },
  {
    q: "Comment se passe la facturation ?",
    a: "Forfait fixe par agent + variable sur les outcomes (lead qualifié, ticket résolu, contrat signé). Pas de facturation au token, pas de surfacturation surprise. Annulation en un clic.",
  },
  {
    q: "Puis-je changer le modèle d'IA utilisé par mes agents ?",
    a: "Oui — chaque agent peut être lancé sur Claude Sonnet, Claude Opus, GPT-4o ou Gemini selon vos besoins de qualité, latence ou coût. Le routage est multi-provider avec fallback automatique.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-24 bg-bg-2 border-t border-line">
      <div className="container-x">
        <div className="grid md:grid-cols-[1fr_1.5fr] gap-12">
          <div>
            <span className="text-[13px] font-medium tracking-widest uppercase text-brand-blue-2">
              Questions fréquentes
            </span>
            <h2 className="text-[clamp(36px,5vw,52px)] leading-tight tracking-tight font-medium mt-4">
              On vous répond <span className="font-serif italic">vraiment.</span>
            </h2>
            <p className="text-ink-2 mt-5">
              Si votre question n'est pas là :{" "}
              <a
                href="mailto:contact@axion.ai"
                className="text-brand-blue-2 hover:underline"
              >
                contact@axion.ai
              </a>
            </p>
          </div>
          <div>
            {QA.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={i}
                  className="border-b border-line py-5 first:pt-0"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-5 text-left text-base font-medium text-ink hover:text-brand-blue-2 transition-colors"
                  >
                    {item.q}
                    <span
                      className={cn(
                        "size-7 rounded-full bg-bg-3 border border-line flex items-center justify-center shrink-0 transition-transform",
                        isOpen && "rotate-45",
                      )}
                    >
                      <Plus className="size-4 text-ink-2" />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 text-ink-2 text-sm leading-relaxed",
                      isOpen ? "max-h-96 pt-3.5" : "max-h-0",
                    )}
                  >
                    {item.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
