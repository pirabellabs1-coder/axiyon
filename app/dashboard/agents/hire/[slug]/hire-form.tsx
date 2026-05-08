"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { AgentTemplate } from "@/lib/agents/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HireForm({ template }: { template: AgentTemplate }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateSlug: template.slug,
        name: String(fd.get("name") ?? template.name),
        budgetPerDayEur: Number(fd.get("budget") ?? 10),
        customPrompt: String(fd.get("prompt") ?? "") || undefined,
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `HTTP ${r.status}`);
      setLoading(false);
      return;
    }
    const agent = (await r.json()) as { id: string };
    router.push(`/dashboard/agents/${agent.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom donné à l'agent</Label>
        <Input id="name" name="name" defaultValue={template.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="budget">Budget journalier (EUR)</Label>
        <Input id="budget" name="budget" type="number" min={1} max={1000} defaultValue={10} />
        <p className="text-xs text-ink-3">
          L'agent s'arrête automatiquement si son budget journalier est atteint.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt">Prompt personnalisé (optionnel)</Label>
        <textarea
          id="prompt"
          name="prompt"
          rows={6}
          placeholder="Laissez vide pour utiliser le prompt par défaut."
          className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-y"
        />
        <p className="text-xs text-ink-3">
          Ajoute votre voix de marque, vos red lines, vos préférences de format.
        </p>
      </div>
      <Button type="submit" variant="glow" disabled={loading} className="w-full justify-center">
        {loading ? "Création…" : `Embaucher ${template.name} →`}
      </Button>
    </form>
  );
}
