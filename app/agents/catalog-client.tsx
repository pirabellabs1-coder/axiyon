"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { TEMPLATES, categoryLabel, listCategories } from "@/lib/agents/catalog";
import { AgentIcon } from "@/components/agent-icon";
import { cn } from "@/lib/utils";

export function CatalogClient() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const cats = listCategories();

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!ql) return true;
      return (
        t.name.toLowerCase().includes(ql) ||
        t.role.toLowerCase().includes(ql) ||
        t.description.toLowerCase().includes(ql) ||
        t.skills.some((s) => s.toLowerCase().includes(ql))
      );
    });
  }, [q, category]);

  return (
    <div className="container-x">
      <div className="sticky top-[72px] z-10 -mx-5 sm:-mx-8 px-5 sm:px-8 py-4 bg-bg/85 backdrop-blur-md border-y border-line mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-bg-2 border border-line rounded-md px-3">
            <Search className="size-4 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un agent (ex : SDR, finance, contrat…)"
              className="flex-1 bg-transparent py-2.5 text-sm placeholder:text-ink-3 focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-px">
            <CategoryButton
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="Tous"
            />
            {cats.map((c) => (
              <CategoryButton
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
                label={categoryLabel(c as never)}
              />
            ))}
          </div>
          <span className="text-xs text-ink-3 font-mono ml-auto tabular-nums">
            {filtered.length} agent{filtered.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tpl) => (
          <div key={tpl.slug} className="card flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AgentIcon name={tpl.icon} />
              <div className="flex-1 min-w-0">
                <div className="font-medium leading-tight">
                  <span className="text-brand-blue-2">{tpl.name}</span>{" "}
                  <span className="text-sm text-ink-2">· {tpl.role}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-ink-3 mt-1">
                  {categoryLabel(tpl.category)}
                </div>
              </div>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed flex-1">{tpl.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {tpl.skills.map((s) => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
            <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
              <span className="text-ink-2 font-mono">{tpl.priceEurMonthly} €/mois</span>
              <span className="text-brand-green font-mono inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-brand-green" />
                Disponible
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-ink-3 text-sm">
          Aucun agent ne correspond à cette recherche.
        </div>
      )}
    </div>
  );
}

function CategoryButton({
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
      className={cn(
        "px-3 py-1.5 rounded-md border text-xs whitespace-nowrap transition-colors font-medium",
        active
          ? "bg-brand-blue text-white border-brand-blue"
          : "border-line bg-bg-2 text-ink-2 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
