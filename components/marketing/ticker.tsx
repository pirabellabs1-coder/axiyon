/** Live activity ticker — restored from the legacy HTML landing. */
const ITEMS = [
  ["LIVE", "SDR-04", "84 prospects qualifiés à l'instant chez ", "Linear"],
  ["LIVE", "FIN-01", "clôture mensuelle terminée chez ", "Maison Margiela", "11 min"],
  ["LIVE", "SUP-12", "1 247 tickets résolus en 24h chez ", "Doctolib"],
  ["LIVE", "REC-02", "38 candidats sourcés cette nuit pour ", "BlaBlaCar"],
  ["LIVE", "OPS-08", "pipeline ETL réparé de manière autonome · ", "Mirakl"],
  ["LIVE", "CFO-03", "forecast 6 mois mis à jour pour ", "Helia"],
] as const;

export function MarketingTicker() {
  const items = [...ITEMS, ...ITEMS];
  return (
    <div className="border-y border-line bg-bg-2 py-5 overflow-hidden">
      <div className="flex gap-16 whitespace-nowrap animate-[ticker_40s_linear_infinite]">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3.5 text-sm text-ink-2 flex-shrink-0">
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand-green/30 bg-brand-green/10 text-brand-green font-mono">
              {it[0]}
            </span>
            <span className="font-mono text-ink">{it[1]}</span>
            <span>· {it[2]}</span>
            <strong className="text-ink">{it[3]}</strong>
            {it[4] && <span className="text-ink-3 text-xs ml-1">{it[4]}</span>}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
