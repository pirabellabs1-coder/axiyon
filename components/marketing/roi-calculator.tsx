"use client";
import { useMemo, useState } from "react";

export function ROICalculator() {
  const [agents, setAgents] = useState(3);
  const [salary, setSalary] = useState(4500);
  const [productivity, setProductivity] = useState(3);

  const { savings, roi, payback } = useMemo(() => {
    const cost = agents * 299 * 12;
    const replaced = agents * productivity;
    const humanCost = replaced * salary * 12;
    const _savings = Math.round(humanCost - cost);
    const _roi = humanCost && cost ? humanCost / cost : 0;
    const _payback = _roi > 0 ? Math.max(1, Math.round((365 / _roi / agents) * 0.3)) : 0;
    return { savings: _savings, roi: _roi, payback: _payback };
  }, [agents, salary, productivity]);

  return (
    <section className="py-24 bg-bg-2 border-t border-line">
      <div className="container-x">
        <div className="rounded-2xl border border-line bg-bg p-8 md:p-12 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[13px] font-medium tracking-widest uppercase text-brand-blue-2">
              Calculateur ROI
            </span>
            <h3 className="text-3xl tracking-tight font-medium mt-3 mb-3">
              Combien Axion <span className="font-serif italic">vous coûte vraiment ?</span>
            </h3>
            <p className="text-ink-2 mb-7">
              Comparé à un employé humain à plein temps. Glissez les curseurs.
            </p>
            <div className="flex flex-col gap-5">
              <Slider
                label="Nombre d'agents"
                value={`${agents}`}
                min={1}
                max={20}
                step={1}
                v={agents}
                onChange={setAgents}
              />
              <Slider
                label="Salaire chargé / employé remplacé"
                value={`${salary.toLocaleString("fr-FR")} €`}
                min={2000}
                max={10000}
                step={500}
                v={salary}
                onChange={setSalary}
              />
              <Slider
                label="Productivité d'un agent vs. humain"
                value={`${productivity}×`}
                min={1}
                max={6}
                step={0.5}
                v={productivity}
                onChange={setProductivity}
              />
            </div>
          </div>
          <div
            className="rounded-2xl border border-brand-blue p-9 text-center"
            style={{
              background:
                "linear-gradient(135deg,rgba(91,108,255,.12),rgba(34,211,238,.08))",
            }}
          >
            <div className="text-xs text-ink-2 uppercase tracking-widest mb-3 font-mono">
              Économies / an
            </div>
            <div className="text-6xl font-medium tracking-tight gradient-text mb-2 tabular-nums">
              {savings.toLocaleString("fr-FR")} €
            </div>
            <div className="text-ink-2 text-sm mt-2">
              {agents} agent{agents > 1 ? "s" : ""} Axion (Growth) ·{" "}
              {(agents * productivity).toFixed(0)} ETP-équivalents remplacés
            </div>
            <div className="text-brand-green text-sm mt-2 font-mono">
              → ROI <strong>{roi.toFixed(1)}×</strong> · payback {payback} jours
            </div>
            <div className="text-ink-3 text-xs mt-5">
              Et avec Puter, l'IA elle-même est gratuite — vous payez l'orchestration.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  v,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-2">{label}</span>
        <span className="font-mono text-ink font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-blue"
      />
    </label>
  );
}
