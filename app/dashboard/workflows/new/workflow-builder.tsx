"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2, ArrowDown, GitBranch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentIcon } from "@/components/agent-icon";

interface AgentMeta {
  slug: string;
  name: string;
  role: string;
  category: string;
  categoryLabel: string;
  icon: string;
}

interface BuilderStep {
  id: string;
  agent_slug: string;
  action: string;
  depends_on: string[];
}

const SLUG_RE = /^[a-z0-9-]+$/;

function makeStepId(idx: number): string {
  return `step-${idx + 1}`;
}

export function WorkflowBuilder({ agents }: { agents: AgentMeta[] }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");

  const [steps, setSteps] = useState<BuilderStep[]>([
    { id: "step-1", agent_slug: agents[0]?.slug ?? "", action: "", depends_on: [] },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedAgents = useMemo(() => {
    const groups: Record<string, AgentMeta[]> = {};
    for (const a of agents) {
      (groups[a.categoryLabel] = groups[a.categoryLabel] || []).push(a);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [agents]);

  function autoSlugFromName(n: string) {
    return n
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  function addStep() {
    setSteps((prev) => {
      const id = makeStepId(prev.length);
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          id,
          agent_slug: agents[0]?.slug ?? "",
          action: "",
          depends_on: last ? [last.id] : [],
        },
      ];
    });
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id).map((s) => ({
      ...s,
      depends_on: s.depends_on.filter((d) => d !== id),
    })));
  }

  function updateStep(id: string, patch: Partial<BuilderStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function toggleDep(stepId: string, depId: string) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const has = s.depends_on.includes(depId);
        return {
          ...s,
          depends_on: has ? s.depends_on.filter((d) => d !== depId) : [...s.depends_on, depId],
        };
      }),
    );
  }

  async function onSave() {
    setError(null);
    if (!name.trim()) return setError("Le nom est requis");
    if (!slug.trim()) return setError("Le slug est requis");
    if (!SLUG_RE.test(slug)) return setError("Slug invalide (a-z, 0-9, tirets uniquement)");
    if (steps.some((s) => !s.agent_slug)) return setError("Chaque étape doit avoir un agent");
    if (steps.some((s) => !s.action.trim())) return setError("Chaque étape doit avoir une instruction");

    setSaving(true);
    try {
      const r = await fetch("/api/v1/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          spec: {
            name: name.trim(),
            description: description.trim() || undefined,
            schedule_cron: scheduleCron.trim() || undefined,
            steps: steps.map((s) => ({
              id: s.id,
              agent_slug: s.agent_slug,
              action: s.action.trim(),
              depends_on: s.depends_on.length ? s.depends_on : undefined,
            })),
          },
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; detail?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.push("/dashboard/workflows");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Meta */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-medium">Informations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nom *">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!slug || slug === autoSlugFromName(name)) setSlug(autoSlugFromName(v));
                }}
                placeholder="Deal Flow Hebdomadaire"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              />
            </Field>
            <Field label="Slug *">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="deal-flow-hebdo"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="À quoi sert ce workflow ?"
              className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-y"
            />
          </Field>
          <Field label="Schedule (cron) — optionnel">
            <input
              type="text"
              value={scheduleCron}
              onChange={(e) => setScheduleCron(e.target.value)}
              placeholder="0 9 * * 1  (chaque lundi 9h)"
              className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-ink-2" />
          <h3 className="font-medium">Étapes ({steps.length})</h3>
        </div>

        {steps.map((step, idx) => {
          const tpl = agents.find((a) => a.slug === step.agent_slug);
          const eligibleDeps = steps.filter((s) => s.id !== step.id);
          return (
            <div key={step.id}>
              {idx > 0 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="size-4 text-ink-3" />
                </div>
              )}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-mono text-ink-3 px-2 py-1 rounded bg-bg-3">
                        {step.id}
                      </span>
                      {tpl && (
                        <div className="flex items-center gap-2">
                          <AgentIcon name={tpl.icon} size={13} wrapperClassName="size-7" />
                          <span className="text-sm font-medium">{tpl.name}</span>
                          <span className="text-xs text-ink-3">· {tpl.role}</span>
                        </div>
                      )}
                    </div>
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(step.id)}
                        className="text-ink-3 hover:text-brand-red text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="size-3.5" /> Retirer
                      </button>
                    )}
                  </div>

                  <Field label="Agent">
                    <select
                      value={step.agent_slug}
                      onChange={(e) => updateStep(step.id, { agent_slug: e.target.value })}
                      className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm font-mono"
                    >
                      {groupedAgents.map(([cat, list]) => (
                        <optgroup key={cat} label={cat}>
                          {list.map((a) => (
                            <option key={a.slug} value={a.slug}>
                              {a.name} — {a.role}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>

                  <Field label="Instruction donnée à l'agent">
                    <textarea
                      value={step.action}
                      onChange={(e) => updateStep(step.id, { action: e.target.value })}
                      rows={3}
                      placeholder="Ex : Source 50 prospects matchant l'ICP cible et qualifie-les."
                      className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-y"
                    />
                  </Field>

                  {eligibleDeps.length > 0 && (
                    <Field label="Dépend de (étapes en amont qui doivent finir avant)">
                      <div className="flex flex-wrap gap-1.5">
                        {eligibleDeps.map((d) => {
                          const checked = step.depends_on.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => toggleDep(step.id, d.id)}
                              className={
                                "px-2 py-1 rounded text-[11px] font-mono border transition-colors " +
                                (checked
                                  ? "bg-brand-blue/10 border-brand-blue/30 text-brand-blue-2"
                                  : "bg-bg-3 border-line text-ink-3 hover:text-ink hover:border-ink-3")
                              }
                            >
                              {d.id}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}

        <Button variant="outline" onClick={addStep} className="w-full">
          <Plus className="size-4" /> Ajouter une étape
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => router.push("/dashboard/workflows")}>
          Annuler
        </Button>
        <Button onClick={onSave} disabled={saving} variant="glow">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer le workflow
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-ink-3 font-mono mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
