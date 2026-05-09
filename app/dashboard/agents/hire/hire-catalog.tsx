"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, X, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentIcon } from "@/components/agent-icon";

interface Template {
  slug: string;
  name: string;
  role: string;
  category: string;
  categoryLabel: string;
  icon: string;
  description: string;
  skills: string[];
  defaultTools: string[];
  priceEurMonthly: number;
}

const PRICE_TIERS = [
  { value: "all",   label: "Tous les tarifs" },
  { value: "lt300", label: "< 300 €/mois" },
  { value: "300_500", label: "300 – 500 €/mois" },
  { value: "gt500", label: "> 500 €/mois" },
];

export function HireCatalog({ templates }: { templates: Template[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [priceTier, setPriceTier] = useState<string>("all");

  // Categories ordered by frequency in the catalog so the most useful
  // tabs come first.
  const categories = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const t of templates) {
      const cur = counts.get(t.category);
      counts.set(t.category, {
        label: t.categoryLabel,
        n: (cur?.n ?? 0) + 1,
      });
    }
    return Array.from(counts.entries())
      .map(([k, v]) => ({ key: k, label: v.label, n: v.n }))
      .sort((a, b) => b.n - a.n);
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (priceTier === "lt300" && t.priceEurMonthly >= 300) return false;
      if (priceTier === "300_500" && (t.priceEurMonthly < 300 || t.priceEurMonthly > 500))
        return false;
      if (priceTier === "gt500" && t.priceEurMonthly <= 500) return false;
      if (!q) return true;
      const hay = `${t.name} ${t.role} ${t.description} ${t.skills.join(" ")} ${t.defaultTools.join(" ")} ${t.categoryLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query, category, priceTier]);

  const hasFilter = query.trim() !== "" || category !== "all" || priceTier !== "all";

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-3 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, rôle, compétence ou outil…"
          className="w-full bg-bg-2 border border-line rounded-lg pl-10 pr-10 py-3 text-sm placeholder:text-ink-3 focus:outline-none focus:border-brand-blue/50 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Effacer"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Pill
          active={category === "all"}
          onClick={() => setCategory("all")}
          label={`Tous · ${templates.length}`}
        />
        {categories.map((c) => (
          <Pill
            key={c.key}
            active={category === c.key}
            onClick={() => setCategory(c.key)}
            label={`${c.label} · ${c.n}`}
          />
        ))}
        <span className="ml-auto" />
        <select
          value={priceTier}
          onChange={(e) => setPriceTier(e.target.value)}
          className="bg-bg-2 border border-line rounded-md px-3 py-1.5 text-xs font-mono text-ink-2 focus:outline-none focus:border-brand-blue/50"
        >
          {PRICE_TIERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Result counter */}
      <div className="flex items-center justify-between text-xs font-mono text-ink-3">
        <span>
          {filtered.length} agent{filtered.length > 1 ? "s" : ""} trouvé
          {filtered.length > 1 ? "s" : ""}
        </span>
        {hasFilter && (
          <button
            onClick={() => {
              setQuery("");
              setCategory("all");
              setPriceTier("all");
            }}
            className="hover:text-ink"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Sparkles className="size-10 text-ink-3 mx-auto" strokeWidth={1.5} />
            <p className="text-ink-2">
              Aucun agent ne correspond à vos critères. Essayez de retirer un filtre.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setPriceTier("all");
              }}
            >
              Voir tout le catalogue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((tpl) => (
            <Card
              key={tpl.slug}
              className="hover:border-brand-blue transition-colors group"
            >
              <CardContent className="p-5 flex flex-col gap-4 h-full">
                <div className="flex items-start gap-3">
                  <AgentIcon name={tpl.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium leading-tight">
                      <span className="text-brand-blue-2">{tpl.name}</span>{" "}
                      <span className="text-ink-2 text-sm">· {tpl.role}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-3 font-mono mt-1">
                      {tpl.categoryLabel}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-ink-2 leading-relaxed flex-1">
                  {tpl.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.skills.slice(0, 4).map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="pt-4 border-t border-line flex items-center justify-between">
                  <span className="text-xs text-ink-2 font-mono">
                    {tpl.priceEurMonthly} €/mois
                  </span>
                  <Button asChild variant="glow" size="sm">
                    <Link href={`/dashboard/agents/hire/${tpl.slug}`}>
                      Recruter <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
        active
          ? "bg-bg-3 text-ink border border-line-2"
          : "bg-bg-2 text-ink-2 border border-line hover:border-line-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
