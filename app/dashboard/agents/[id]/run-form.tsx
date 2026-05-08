"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface RunResult {
  taskId: string;
  status: "succeeded" | "failed";
  text: string;
  toolCalls: Array<{ name: string; args: unknown; result?: unknown }>;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
  modelUsed: string | null;
  error?: string;
}

export function RunForm({
  agentId,
  suggestedObjective,
}: {
  agentId: string;
  suggestedObjective: string;
}) {
  const router = useRouter();
  const [objective, setObjective] = useState(suggestedObjective);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    const r = await fetch(`/api/agents/${agentId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `HTTP ${r.status}`);
      setLoading(false);
      return;
    }
    const data = (await r.json()) as RunResult;
    setResult(data);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <textarea
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        rows={4}
        placeholder="Décrivez l'objectif…"
        className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-y font-sans"
      />
      <div className="flex justify-end">
        <Button onClick={onRun} disabled={loading || !objective.trim()} variant="glow">
          {loading ? "L'agent travaille…" : "Lancer la tâche →"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-md border border-line bg-bg-3 p-4">
          <div className="flex items-center justify-between">
            <span
              className={
                "text-xs font-mono " +
                (result.status === "succeeded" ? "text-brand-green" : "text-brand-red")
              }
            >
              ● {result.status}
            </span>
            <span className="text-xs text-ink-3 font-mono">
              {result.modelUsed ?? "—"} · {result.tokensIn + result.tokensOut} tokens · {result.costEur.toFixed(4)} €
            </span>
          </div>
          {result.text && (
            <div className="rounded-md bg-bg-2 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              {result.text}
            </div>
          )}
          {result.toolCalls.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-ink-2 hover:text-ink">
                {result.toolCalls.length} appel(s) d'outils
              </summary>
              <ul className="mt-2 space-y-2">
                {result.toolCalls.map((tc, i) => (
                  <li key={i} className="rounded border border-line bg-bg p-2 font-mono">
                    <div className="text-brand-cyan">{tc.name}</div>
                    <pre className="text-ink-3 mt-1 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(tc.args, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
