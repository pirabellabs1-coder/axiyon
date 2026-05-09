"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Plus, Search, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, relativeTime } from "@/lib/utils";

interface MemoryItem {
  id: string;
  kind: string;
  content: string;
  summary: string | null;
  importance: number;
  source: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  semantic: "Sémantique",
  episodic: "Épisodique",
  procedural: "Procédurale",
  client: "Client",
  task: "Tâche",
};

const KIND_COLOR: Record<string, string> = {
  semantic: "text-brand-blue-2",
  episodic: "text-brand-magenta",
  procedural: "text-brand-cyan",
  client: "text-brand-green",
  task: "text-brand-yellow",
};

export function MemoryClient({ entries }: { entries: MemoryItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  const kinds = useMemo(() => Array.from(new Set(entries.map((e) => e.kind))), [entries]);
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      if (search.trim() && !e.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filter, search]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    const fd = new FormData(e.currentTarget);
    await fetch("/api/v1/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: String(fd.get("content") ?? ""),
        kind: String(fd.get("kind") ?? "semantic"),
        importance: Number(fd.get("importance") ?? 0.5),
      }),
    });
    setAdding(false);
    setShowAdd(false);
    router.refresh();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Supprimer cette entrée mémoire ?")) return;
    await fetch(`/api/v1/memory/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Mémoire d'organisation</h1>
          <p className="text-ink-2 mt-1.5">
            Faits, SOPs, leçons, fiches client. Vos agents lisent ici en permanence
            pour rester cohérents avec votre historique.
          </p>
        </div>
        <Button variant="glow" onClick={() => setShowAdd(true)}>
          <Plus className="size-4" /> Ajouter une entrée
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Total" value={entries.length} accent="text-brand-blue" />
        {Object.keys(KIND_LABEL).map((k) => (
          <StatTile
            key={k}
            label={KIND_LABEL[k]}
            value={entries.filter((e) => e.kind === k).length}
            accent={KIND_COLOR[k]}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-bg-2 border border-line rounded-md px-3">
          <Search className="size-4 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer le contenu…"
            className="flex-1 bg-transparent py-2.5 text-sm placeholder:text-ink-3 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label="Tous" />
          {kinds.map((k) => (
            <FilterPill
              key={k}
              active={filter === k}
              onClick={() => setFilter(k)}
              label={KIND_LABEL[k] ?? k}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <div className="size-12 rounded-xl bg-grad shadow-glow mx-auto flex items-center justify-center">
              <Brain className="size-6 text-white" strokeWidth={1.6} />
            </div>
            <p className="text-ink-2">Aucune entrée — vos agents commenceront à enrichir la mémoire automatiquement.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {filtered.map((e) => (
              <li key={e.id} className="p-4 hover:bg-bg-3/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={cn("size-9 rounded-md bg-bg-3 border border-line flex items-center justify-center shrink-0", KIND_COLOR[e.kind])}>
                    <Brain className="size-4" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border border-line bg-bg-3", KIND_COLOR[e.kind])}>
                        {KIND_LABEL[e.kind] ?? e.kind}
                      </span>
                      <span className="text-[10px] font-mono text-ink-3">
                        importance {Math.round(e.importance * 100)}%
                      </span>
                      {e.source && <span className="text-[10px] font-mono text-ink-3">source : {e.source}</span>}
                      <span className="text-[10px] font-mono text-ink-3 ml-auto">{relativeTime(e.createdAt)}</span>
                    </div>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {e.content.slice(0, 600)}
                      {e.content.length > 600 && "…"}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEntry(e.id)}
                    className="text-ink-3 hover:text-brand-red p-1.5 rounded-md hover:bg-bg-3"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-bg/80 backdrop-blur-sm p-4"
          onClick={() => setShowAdd(false)}
        >
          <form
            onSubmit={onAdd}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg card p-6 space-y-4"
          >
            <h3 className="text-lg font-medium">Ajouter une entrée</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-2 font-mono">
                Type
              </label>
              <select
                name="kind"
                defaultValue="semantic"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm font-mono"
              >
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-2 font-mono">
                Importance (0–1)
              </label>
              <input
                type="number"
                name="importance"
                min="0"
                max="1"
                step="0.05"
                defaultValue="0.5"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-2 font-mono">
                Contenu
              </label>
              <textarea
                name="content"
                rows={6}
                required
                placeholder="Écrivez un fait, une SOP, une leçon apprise…"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-y"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="glow" className="flex-1" disabled={adding}>
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-ink-2 mb-1">{label}</div>
        <div className={cn("text-xl font-medium tabular-nums", accent)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterPill({
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
