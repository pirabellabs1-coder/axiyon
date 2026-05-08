const LOGOS = [
  "Helia", "Mirakl", "Doctolib", "Linear", "BlaBlaCar", "Maison Margiela",
  "Veepee", "Qonto", "Aircall", "PayFit", "Alan", "Lydia",
  "Ankorstore", "Spendesk", "Pennylane", "Algolia", "Datadog", "Mistral",
];

export function CustomerWall() {
  return (
    <section className="py-20 bg-bg-2 border-y border-line">
      <div className="container-x">
        <div className="text-center text-xs uppercase tracking-widest text-ink-3 mb-10 font-mono">
          Construit avec — et utilisé par
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-line border border-line rounded-xl overflow-hidden">
          {LOGOS.map((name) => (
            <div
              key={name}
              className="bg-bg p-8 text-center font-serif text-lg text-ink-2 hover:text-ink transition-colors flex items-center justify-center"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
