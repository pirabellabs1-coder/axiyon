/** Three-step "how it works" — restored from legacy HTML. */
export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Choisir l'agent",
      desc: "Parcourez le catalogue. Iris pour la vente, Atlas pour la finance, Sage pour le support… chacun arrive avec un cerveau pré-entraîné et des outils branchés.",
      chips: ["50+ agents", "10 verticales"],
    },
    {
      n: "02",
      title: "Brancher les outils",
      desc: "Vos données restent chez vous, l'agent les utilise sans les copier. Vos agents pensent gratuitement via Puter (Claude Sonnet 4.5).",
      chips: ["15 outils branchés", "Puter — IA gratuite illimitée"],
    },
    {
      n: "03",
      title: "Déléguer le résultat",
      desc: "Vous donnez l'objectif. L'agent planifie, exécute, vous rend des comptes, escalade les décisions stratégiques. Vous payez le résultat livré.",
      chips: ["Result-based", "Replay & audit"],
    },
  ];
  return (
    <section className="py-24">
      <div className="container-x">
        <div className="mb-16 max-w-3xl">
          <span className="text-[13px] font-medium tracking-widest uppercase text-brand-blue-2">
            En pratique
          </span>
          <h2 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.03em] font-medium mt-4">
            De la signature au premier dollar généré :{" "}
            <span className="font-serif italic">trois étapes.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-line bg-bg-2 p-8 relative hover:border-brand-blue transition-colors hover:-translate-y-px"
            >
              <div className="absolute top-6 right-7 text-6xl font-serif text-bg-3 leading-none">
                {s.n}
              </div>
              <h4 className="text-xl font-medium mb-3 mt-1">{s.title}</h4>
              <p className="text-ink-2 text-sm leading-relaxed">{s.desc}</p>
              <div className="mt-6 flex gap-2 flex-wrap">
                {s.chips.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
