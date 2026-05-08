"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "orchestrate",
    label: "Orchestration",
    title: "Multi-agents qui collaborent comme une vraie équipe",
    desc: "Vos agents se parlent. Iris (SDR) qualifie un lead, Atlas (CFO) valide la marge, Codex (juriste) prépare le contrat — pendant que vous dormez. Axion orchestre, gère les blocages, escalade.",
    features: [
      ["Workflows visuels", "drag & drop, ou en langage naturel"],
      ["Handoff intelligent", "l'agent sait à qui parler ensuite"],
      ["Approbations humaines", "vous gardez le dernier mot"],
      ["Replay complet", "chaque décision est rejouable"],
    ],
  },
  {
    id: "memory",
    label: "Mémoire",
    title: "Une mémoire d'entreprise. Pas un goldfish.",
    desc: "Knowledge graph + mémoire vectorielle + mémoire épisodique. Vos agents retiennent l'historique de chaque client, chaque décision, chaque nuance de votre secteur.",
    features: [
      ["Knowledge graph", "liens entre clients, décisions, documents"],
      ["Onboarding silencieux", "absorbe vos archives en quelques heures"],
      ["Apprentissage continu", "s'améliore à chaque feedback"],
      ["Export complet", "votre mémoire est à vous, exportable"],
    ],
  },
  {
    id: "govern",
    label: "Gouvernance",
    title: "Une gouvernance digne d'une banque.",
    desc: "Permissions par rôle, budgets d'action, approbations à seuil, audit immuable. Conçu pour passer un audit Big 4 sans frémir.",
    features: [
      ["RBAC granulaire", "jusqu'à l'appel d'outil individuel"],
      ["Budgets & limits", "€ par jour, par tâche, par client"],
      ["Audit immuable", "chaîne SHA-256 vérifiable"],
      ["Conformité native", "SOC 2, ISO 27001, HIPAA, AI Act, GDPR"],
    ],
  },
  {
    id: "puter",
    label: "Puter — gratuit",
    title: "Claude Sonnet 4.5 — gratuit, illimité, dans le navigateur.",
    desc: "Axion s'appuie sur Puter pour exécuter les agents côté navigateur. Pas d'API key à gérer, pas de quota plate-forme, pas de facturation IA — vous payez l'orchestration Axion, l'IA est offerte par Puter.",
    features: [
      ["Claude Sonnet 4.5", "le meilleur modèle Anthropic, à 0 €"],
      ["GPT-4o", "OpenAI dispo aussi en un toggle"],
      ["500+ modèles", "Anthropic · OpenAI · Google · xAI · DeepSeek · Mistral"],
      ["Function calling", "tool calls réels jusqu'à votre serveur"],
    ],
  },
];

export function PlatformTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  return (
    <section className="py-24 bg-bg-2 border-y border-line">
      <div className="container-x">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-[13px] font-medium tracking-widest uppercase text-brand-blue-2">
            La plateforme
          </span>
          <h2 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.03em] font-medium mt-4">
            Pas un chatbot. <span className="font-serif italic">Une équipe.</span>
          </h2>
          <p className="text-lg text-ink-2 mt-5">
            Axion fournit la mémoire, les outils, la gouvernance et l'orchestration multi-agents que les modèles seuls ne peuvent pas donner.
          </p>
        </div>

        <div className="flex justify-center mb-14">
          <div className="inline-flex gap-1 bg-bg border border-line p-1.5 rounded-2xl">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActive(i)}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm transition-colors",
                  i === active ? "bg-bg-3 text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_1.2fr] gap-16 items-center">
          <div>
            <h3 className="text-3xl tracking-tight font-medium mb-4">{tab.title}</h3>
            <p className="text-ink-2 mb-7 text-lg leading-relaxed">{tab.desc}</p>
            <ul className="divide-y divide-line">
              {tab.features.map(([h, p]) => (
                <li key={h} className="flex gap-3 py-3.5">
                  <span className="text-brand-blue mt-0.5">✓</span>
                  <span>
                    <strong className="text-ink">{h}</strong>{" "}
                    <span className="text-ink-2">— {p}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-bg-3 p-7 shadow-elev relative overflow-hidden min-h-[480px]">
            <div
              className="absolute -top-32 -right-32 size-96 rounded-full opacity-10 blur-3xl"
              style={{ background: "linear-gradient(135deg,#5B6CFF,#22D3EE)" }}
            />
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-line relative">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-line-2" />
                <span className="size-2.5 rounded-full bg-line-2" />
                <span className="size-2.5 rounded-full bg-line-2" />
              </div>
              <span className="font-mono text-xs text-ink-3">workflow · deal-flow.axn</span>
            </div>
            <div className="space-y-4 relative">
              <Bubble
                who="Vous"
                role="Founder"
                avatarClass="bg-bg border border-line text-ink-2"
                text="Trouve 50 prospects ICP cette semaine, qualifie-les, et organise des démos — uniquement avec ceux dont la marge attendue dépasse 80k€."
              />
              <Bubble
                who="Iris"
                role="SDR"
                avatarClass="bg-grad text-white"
                text="D'accord. Je sources sur LinkedIn et Apollo, je délègue l'analyse de marge à Atlas, et je booke avec ceux qui passent."
                tool={["linkedin.search", 'icp="VP Data, Series B+"', "→ 184 candidats trouvés"]}
              />
              <Bubble
                who="Atlas"
                role="CFO"
                avatarClass="text-white"
                avatarStyle={{ background: "linear-gradient(135deg,#FF3D8E,#5B6CFF)" }}
                text="Sur les 184, 67 ont un budget data > 200k€/an. Marge brute estimée : 71-94k€. Je passe les 51 meilleurs à Iris."
              />
              <Bubble
                who="Iris"
                role="SDR"
                avatarClass="bg-grad text-white"
                text="Séquence d'outreach lancée. 6 démos confirmées sur ton calendrier mardi-jeudi. ✅"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({
  who,
  role,
  avatarClass,
  avatarStyle,
  text,
  tool,
}: {
  who: string;
  role: string;
  avatarClass?: string;
  avatarStyle?: React.CSSProperties;
  text: string;
  tool?: [string, string, string];
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className={cn(
          "size-8 rounded-md flex items-center justify-center text-xs font-semibold shrink-0",
          avatarClass,
        )}
        style={avatarStyle}
      >
        {who[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium flex items-center gap-2 mb-1">
          {who}
          <span className="text-[10px] px-1.5 py-px rounded border border-line bg-bg text-ink-2 font-normal font-mono">
            {role}
          </span>
        </div>
        <div className="text-sm text-ink-2 leading-relaxed">{text}</div>
        {tool && (
          <div className="mt-2 px-3 py-2 bg-bg border border-line rounded-md font-mono text-[11px] text-ink-2">
            <span className="text-brand-cyan">{tool[0]}</span>({tool[1]})
            <div className="text-brand-green mt-1">{tool[2]}</div>
          </div>
        )}
      </div>
    </div>
  );
}
