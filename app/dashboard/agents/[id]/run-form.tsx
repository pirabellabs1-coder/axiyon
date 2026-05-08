"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { runWithPuter } from "@/lib/agents/puter-runtime";
import type { AgentTemplate } from "@/lib/agents/catalog";

interface ToolCallTrace {
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
}

interface AgentLite {
  id: string;
  name: string;
  templateSlug: string;
  enabledTools: string[];
  customPrompt: string | null;
}

export function RunForm({
  agent,
  template,
  suggestedObjective,
}: {
  agent: AgentLite;
  template: AgentTemplate;
  suggestedObjective: string;
}) {
  const router = useRouter();
  const [objective, setObjective] = useState(suggestedObjective);
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallTrace[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    setLoading(true);
    setError(null);
    setText("");
    setToolCalls([]);

    try {
      const result = await runWithPuter({
        agentId: agent.id,
        templateSlug: agent.templateSlug,
        systemPrompt: agent.customPrompt?.trim() || template.systemPrompt,
        enabledTools: agent.enabledTools.length ? agent.enabledTools : template.defaultTools,
        objective,
        model,
        onText: (chunk) => setText((prev) => prev + chunk),
        onToolCall: (call) => setToolCalls((prev) => [...prev, call]),
      });
      setText(result.text || "(no text returned)");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        rows={4}
        placeholder="Décrivez l'objectif…"
        className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-y font-sans"
        disabled={loading}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-2 uppercase tracking-wider font-mono">
            Modèle
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="rounded-md border border-line bg-bg-2 px-3 py-1.5 text-xs font-mono"
          >
            <option value="claude-sonnet-4-5">claude-sonnet-4-5 (recommandé)</option>
            <option value="claude-sonnet-4">claude-sonnet-4</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini (rapide)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
          </select>
          <span className="text-[10px] text-brand-green font-mono ml-2">
            ● gratuit via Puter
          </span>
        </div>
        <Button onClick={onRun} disabled={loading || !objective.trim()} variant="glow">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              L'agent travaille…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Lancer la tâche →
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          {error.includes("Puter") && (
            <div className="mt-1 text-xs text-ink-2">
              Astuce : Puter doit charger côté navigateur. Si tu utilises un
              bloqueur de scripts, autorise <span className="font-mono">js.puter.com</span>.
            </div>
          )}
        </div>
      )}

      {toolCalls.length > 0 && (
        <details
          open
          className="rounded-md border border-line bg-bg-3 px-4 py-3 text-xs"
        >
          <summary className="cursor-pointer text-ink-2 hover:text-ink font-mono">
            ⚡ {toolCalls.length} appel{toolCalls.length > 1 ? "s" : ""} d'outils
          </summary>
          <ul className="mt-3 space-y-2">
            {toolCalls.map((tc, i) => (
              <li
                key={i}
                className="rounded border border-line bg-bg p-2.5 font-mono"
              >
                <div className="text-brand-cyan flex items-center gap-2">
                  <span>{tc.name}</span>
                  {tc.error && <span className="text-destructive text-[10px]">— ERROR</span>}
                </div>
                <pre className="text-ink-3 mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">
                  args: {JSON.stringify(tc.args, null, 2)}
                </pre>
                {tc.error ? (
                  <pre className="text-destructive mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">
                    {tc.error}
                  </pre>
                ) : (
                  <pre className="text-brand-green mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">
                    {(() => {
                      const s = JSON.stringify(tc.result, null, 2) ?? "";
                      return s.length > 600 ? s.slice(0, 600) + "…" : s;
                    })()}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {text && (
        <div className="rounded-md border border-line bg-bg-3 p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}
