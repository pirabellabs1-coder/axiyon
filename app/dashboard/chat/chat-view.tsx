"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Bot,
  Phone,
  Briefcase,
  Headphones,
  Scale,
  TrendingUp,
  Cog,
  UserSearch,
  AlertCircle,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { runWithPuter, isPuterAvailable } from "@/lib/agents/puter-runtime";
import { CATALOG } from "@/lib/agents/catalog";

interface Agent {
  id: string;
  name: string;
  templateSlug: string;
  status: string;
  enabledTools?: string[];
  systemPrompt?: string;
}

interface ToolCall {
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: { name: string; templateSlug: string };
  toolCalls?: ToolCall[];
  pending?: boolean;
  /** ISO timestamp; rendered as HH:MM in the header. */
  at?: string;
}

const TEMPLATE_GRADIENTS: Record<string, string> = {
  "sdr-outbound":    "from-[#5B6CFF] to-[#22D3EE]",
  "cfo-assistant":   "from-[#FF3D8E] to-[#5B6CFF]",
  "support-l2":      "from-[#22D3EE] to-[#34D399]",
  "legal-counsel":   "from-[#E8B86D] to-[#FF3D8E]",
  "recruiter":       "from-[#FF3D8E] to-[#E8B86D]",
  "devops":          "from-[#5A5A6E] to-[#7C8AFF]",
  "growth-marketer": "from-[#34D399] to-[#22D3EE]",
  "data-scientist":  "from-[#7C8AFF] to-[#FF3D8E]",
  "ops-lead":        "from-[#5A5A6E] to-[#FF3D8E]",
};
const TEMPLATE_ICON: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  "sdr-outbound": Phone,
  "cfo-assistant": Briefcase,
  "support-l2": Headphones,
  "legal-counsel": Scale,
  "recruiter": UserSearch,
  "devops": Cog,
  "growth-marketer": TrendingUp,
};

function gradientFor(slug: string): string {
  return TEMPLATE_GRADIENTS[slug] ?? "from-[#5B6CFF] to-[#22D3EE]";
}
function iconFor(slug: string) {
  return TEMPLATE_ICON[slug] ?? Bot;
}

interface OrgStats {
  budgetUsedEur: number;
  budgetLimitEur: number;
  tasksUsed: number;
  tasksLimit: number;
  pendingApprovals: number;
}

export function ChatView({
  userName,
  agents,
  orgStats,
  connectedProviders = [],
}: {
  userName: string;
  agents: Agent[];
  orgStats: OrgStats;
  /** Slugs of providers the org has connected, e.g. ["google", "slack"]. */
  connectedProviders?: string[];
}) {
  const [activeAgent, setActiveAgent] = useState<Agent | null>(agents[0] ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [puterReady, setPuterReady] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Load conversation history (past tasks reconstructed) when active agent changes.
  useEffect(() => {
    if (!activeAgent) return;
    let cancelled = false;
    setLoadingHistory(true);
    setMessages([]); // clear while loading
    fetch(`/api/v1/chat/history?agentId=${encodeURIComponent(activeAgent.id)}&limit=30`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { turns: Array<{ id: string; role: "user" | "assistant"; content: string; toolCalls?: ToolCall[]; createdAt: string }> }) => {
        if (cancelled) return;
        const restored: ChatMessage[] = data.turns.map((t) => ({
          id: t.id,
          role: t.role,
          content: t.content,
          agent:
            t.role === "assistant" && activeAgent
              ? { name: activeAgent.name, templateSlug: activeAgent.templateSlug }
              : undefined,
          toolCalls: t.toolCalls ?? [],
        }));
        setMessages(restored);
      })
      .catch(() => {
        // Silent — empty state is fine if history fails
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAgent?.id, activeAgent]);

  // Poll for Puter SDK readiness (loaded via <Script> in dashboard layout).
  useEffect(() => {
    if (isPuterAvailable()) {
      setPuterReady(true);
      return;
    }
    const id = setInterval(() => {
      if (isPuterAvailable()) {
        setPuterReady(true);
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Run a single agent in the current thread. Returns the agent_handoff
  // tool call result, if any, so the caller can chain to the target agent.
  async function runAgentInThread(
    agent: Agent,
    objective: string,
  ): Promise<{ handoffTo?: { id: string; name: string }; action?: string } | null> {
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      agent: { name: agent.name, templateSlug: agent.templateSlug },
      toolCalls: [],
      pending: true,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const result = await runWithPuter({
        agentId: agent.id,
        templateSlug: agent.templateSlug,
        systemPrompt:
          agent.systemPrompt ??
          "Tu es un agent autonome qui exécute des objectifs en appelant les outils mis à ta disposition. Sois concis et actionnable.",
        enabledTools: agent.enabledTools ?? [],
        connectedProviders,
        objective,
        onToolCall: (call) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] }
                : m,
            ),
          );
        },
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: result.text, pending: false, toolCalls: result.toolCalls }
            : m,
        ),
      );

      // Detect a successful agent_handoff in the trace.
      for (const tc of result.toolCalls) {
        if (tc.name !== "agent_handoff") continue;
        const r = tc.result as
          | {
              handed_off?: boolean;
              target_agent_id?: string;
              target_agent_name?: string;
              action?: string;
            }
          | undefined;
        if (r?.handed_off && r.target_agent_id && r.target_agent_name) {
          return {
            handoffTo: { id: r.target_agent_id, name: r.target_agent_name },
            action: r.action,
          };
        }
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur Puter";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠ ${msg}`, pending: false }
            : m,
        ),
      );
      return null;
    }
  }

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || !activeAgent || running) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const initialObjective = input.trim();
    setInput("");
    setRunning(true);

    try {
      // Multi-agent loop: run the active agent, and if it hands off to a
      // teammate, automatically pick up the handoff in the same thread.
      // Caps at 5 hops to avoid infinite ping-pong.
      let currentAgent: Agent = activeAgent;
      let currentObjective = initialObjective;
      const MAX_HOPS = 5;
      const visited = new Set<string>();

      for (let hop = 0; hop < MAX_HOPS; hop++) {
        if (visited.has(currentAgent.id)) break; // anti-cycle
        visited.add(currentAgent.id);

        const handoff = await runAgentInThread(currentAgent, currentObjective);
        if (!handoff?.handoffTo) break;

        const target = agents.find((a) => a.id === handoff.handoffTo!.id);
        if (!target) break;

        currentAgent = target;
        currentObjective =
          handoff.action ??
          `${currentAgent.name}, prends le relais sur cet objectif initial : "${initialObjective}".`;
      }
    } finally {
      setRunning(false);
    }
  }

  const headerInitials = useMemo(
    () => (userName[0] ?? "U").toUpperCase(),
    [userName],
  );

  // Aggregate per-tool counts from this conversation's tool calls.
  const toolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of messages) {
      for (const tc of m.toolCalls ?? []) {
        counts[tc.name] = (counts[tc.name] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [messages]);

  // Agents in play = every agent that produced a message in this thread,
  // plus the currently selected one. Mirrors the demo's "Agents en jeu" panel.
  const agentsInPlay = useMemo(() => {
    const ids = new Set<string>();
    if (activeAgent) ids.add(activeAgent.id);
    for (const m of messages) {
      if (m.role === "assistant" && m.agent) {
        const found = agents.find((a) => a.name === m.agent!.name);
        if (found) ids.add(found.id);
      }
    }
    return agents.filter((a) => ids.has(a.id));
  }, [agents, activeAgent, messages]);

  const budgetPct = Math.min(
    100,
    Math.round((orgStats.budgetUsedEur / Math.max(1, orgStats.budgetLimitEur)) * 100),
  );
  const tasksPct = Math.min(
    100,
    Math.round((orgStats.tasksUsed / Math.max(1, orgStats.tasksLimit)) * 100),
  );

  if (agents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Chat</h1>
          <p className="text-ink-2 text-sm mt-1">
            Discutez en direct avec un de vos agents.
          </p>
        </div>
        <Card className="p-12 text-center">
          <Bot className="size-12 text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-lg font-medium mb-1">Aucun agent recruté</h3>
          <p className="text-ink-2 text-sm max-w-md mx-auto mb-6">
            Recrutez d&apos;abord un agent pour pouvoir lui parler.
          </p>
          <Button variant="glow" asChild>
            <a href="/dashboard/agents/hire">Recruter un agent →</a>
          </Button>
        </Card>
      </div>
    );
  }

  const Icon = iconFor(activeAgent?.templateSlug ?? "");

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Conversation avec vos agents</h1>
          <p className="text-ink-2 text-sm mt-1">
            Donnez un objectif. Vos agents s&apos;organisent.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${
            puterReady ? "text-brand-green" : "text-brand-yellow"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              puterReady ? "bg-brand-green animate-pulse" : "bg-brand-yellow"
            }`}
          />
          {puterReady ? "LLM prêt (Puter · Claude)" : "Chargement Puter…"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
        {/* Agent picker */}
        <aside className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-3 px-2 mb-2">
            Vos agents
          </div>
          {agents.map((a) => {
            const I = iconFor(a.templateSlug);
            const active = a.id === activeAgent?.id;
            return (
              <button
                key={a.id}
                onClick={() => setActiveAgent(a)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  active
                    ? "border-brand-blue/50 bg-bg-3"
                    : "border-line bg-bg-2 hover:border-line-2"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`size-8 rounded-md bg-gradient-to-br ${gradientFor(a.templateSlug)} text-white flex items-center justify-center shrink-0`}
                  >
                    <I className="size-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    <div className="text-[10px] font-mono text-ink-3">{a.status}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Chat */}
        <div className="rounded-xl border border-line bg-bg-2 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line bg-bg-3/40">
            <span
              className={`size-8 rounded-md bg-gradient-to-br ${gradientFor(activeAgent?.templateSlug ?? "")} text-white flex items-center justify-center`}
            >
              <Icon className="size-4" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              {agentsInPlay.length > 1 ? (
                <>
                  <div className="font-medium text-sm">
                    Workflow · {agentsInPlay.map((a) => a.name).join(" → ")}
                  </div>
                  <div className="text-[11px] font-mono text-ink-3">
                    {agentsInPlay.length} agents en jeu
                    {messages[0]?.at
                      ? ` · démarré ${formatRelative(messages[0].at)}`
                      : ""}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-sm">{activeAgent?.name}</div>
                  <div className="text-[11px] font-mono text-ink-3">
                    {activeAgent?.status}
                  </div>
                </>
              )}
            </div>
            {(running || agentsInPlay.length > 1) && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-brand-green">
                <span className="size-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(52,211,153,.7)] animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {loadingHistory ? (
              <div className="text-center text-ink-3 text-xs font-mono py-12 animate-pulse">
                Chargement de l&apos;historique…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-ink-3 text-sm py-12">
                Donnez un objectif à <strong>{activeAgent?.name}</strong>. Il choisira ses
                outils et vous tiendra au courant.
              </div>
            ) : (
              messages.map((m) => (
                <Message
                  key={m.id}
                  msg={m}
                  initials={headerInitials}
                  userName={userName}
                />
              ))
            )}
          </div>

          <form onSubmit={send} className="border-t border-line bg-bg-3/40 px-4 py-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                puterReady
                  ? `Donnez un objectif à ${activeAgent?.name?.split(" ")[0] ?? "l'agent"}…`
                  : "Chargement du moteur LLM…"
              }
              disabled={running || !puterReady}
              className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-ink-3 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={running || !puterReady || !input.trim()}
              className="size-9 rounded-md bg-gradient-to-br from-[#5B6CFF] to-[#22D3EE] text-white shadow-[0_4px_16px_rgba(91,108,255,.4)] hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-40"
              aria-label="Envoyer"
            >
              <Send className="size-4" strokeWidth={2.2} />
            </button>
          </form>
        </div>

        {/* Right sidebar — real-data context */}
        <aside className="space-y-4">
          <SidePanel title="Agents en jeu">
            {agentsInPlay.length === 0 ? (
              <div className="text-[11px] text-ink-3">Aucun agent actif.</div>
            ) : (
              agentsInPlay.map((a) => {
                const I = iconFor(a.templateSlug);
                const isActive = a.id === activeAgent?.id;
                return (
                  <div key={a.id} className="rounded-md border border-line bg-bg-3 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`size-6 rounded bg-gradient-to-br ${gradientFor(a.templateSlug)} text-white flex items-center justify-center shrink-0`}
                      >
                        <I className="size-3" strokeWidth={2} />
                      </span>
                      <strong className="text-sm truncate">{a.name}</strong>
                      <span
                        className={`ml-auto size-2 rounded-full shrink-0 ${
                          isActive
                            ? "bg-brand-green shadow-[0_0_6px_rgba(52,211,153,.6)]"
                            : "bg-ink-3"
                        }`}
                      />
                    </div>
                    <div className="text-[11px] text-ink-2">{a.status}</div>
                  </div>
                );
              })
            )}
          </SidePanel>

          <SidePanel title="Outils utilisés">
            {toolCounts.length === 0 ? (
              <div className="text-[11px] text-ink-3">
                Aucun appel d&apos;outil dans cette conversation.
              </div>
            ) : (
              toolCounts.map(([name, n]) => <KV key={name} k={name} v={String(n)} />)
            )}
          </SidePanel>

          <SidePanel title="Budget consommé · ce mois">
            <KV k="Tâches" v={`${orgStats.tasksUsed.toLocaleString("fr-FR")} / ${orgStats.tasksLimit.toLocaleString("fr-FR")}`} />
            <KV
              k="Coût"
              v={`${orgStats.budgetUsedEur.toFixed(2).replace(".", ",")} € / ${orgStats.budgetLimitEur} €`}
            />
            <div className="mt-3 h-1 rounded-full bg-bg-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#5B6CFF] to-[#22D3EE]"
                style={{ width: `${Math.max(budgetPct, tasksPct)}%` }}
              />
            </div>
          </SidePanel>

          <SidePanel title="Approbations">
            {orgStats.pendingApprovals === 0 ? (
              <div className="text-[11px] text-ink-3">Aucune en attente.</div>
            ) : (
              <a
                href="/dashboard/approvals"
                className="block rounded-md border border-brand-yellow/40 bg-brand-yellow/5 p-3 hover:bg-brand-yellow/10 transition-colors"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono text-brand-yellow">
                  <AlertCircle className="size-3.5" />
                  {orgStats.pendingApprovals} en attente
                </div>
                <div className="text-xs text-ink-2 mt-1">
                  Voir et trancher →
                </div>
              </a>
            )}
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}

function SidePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-ink-3 mb-3">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-center text-xs gap-2">
      <span className="font-mono text-ink-3 truncate">{k}</span>
      <span className="font-mono text-ink shrink-0">{v}</span>
    </div>
  );
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelative(iso?: string): string {
  if (!iso) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `il y a ${diffSec}s`;
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  return `il y a ${Math.floor(diffSec / 86400)} j`;
}

function Message({
  msg,
  initials,
  userName,
}: {
  msg: ChatMessage;
  initials: string;
  userName: string;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex gap-3">
        <span className="size-8 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#22D3EE] text-white text-xs font-semibold flex items-center justify-center shrink-0">
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium">{userName}</span>
            {msg.at && (
              <span className="ml-auto text-[10px] font-mono text-ink-3 tabular-nums">
                {formatTime(msg.at)}
              </span>
            )}
          </div>
          <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }
  const Icon = iconFor(msg.agent?.templateSlug ?? "");
  const role = msg.agent?.templateSlug ? CATALOG[msg.agent.templateSlug]?.role : null;
  const hasError = msg.content.startsWith("⚠");
  return (
    <div className="flex gap-3">
      <span
        className={`size-8 rounded-full bg-gradient-to-br ${gradientFor(msg.agent?.templateSlug ?? "")} text-white flex items-center justify-center shrink-0`}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-sm font-medium">{msg.agent?.name ?? "Agent"}</span>
          {role && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-line bg-bg-3 text-ink-2">
              {role}
            </span>
          )}
          {msg.pending ? (
            <span className="text-[10px] font-mono text-ink-3 animate-pulse">
              {msg.toolCalls?.length
                ? `${msg.toolCalls.length} outil${msg.toolCalls.length > 1 ? "s" : ""} appelé${msg.toolCalls.length > 1 ? "s" : ""}…`
                : "réfléchit…"}
            </span>
          ) : null}
          {msg.at && (
            <span className="ml-auto text-[10px] font-mono text-ink-3 tabular-nums">
              {formatTime(msg.at)}
            </span>
          )}
        </div>

        {msg.content && (
          <Markdown content={msg.content} className="text-sm text-ink mb-2" />
        )}

        {msg.toolCalls && msg.toolCalls.length > 0 ? (
          <div className="space-y-1.5 mt-2">
            {msg.toolCalls.map((tc, i) => (
              <ToolCallBlock key={i} tc={tc} />
            ))}
          </div>
        ) : null}

        {hasError && (
          <div className="mt-2 text-[11px] text-brand-red flex items-center gap-1.5">
            <AlertCircle className="size-3" />
            Vérifiez que vous êtes signé in dans Puter (popup auto au premier appel).
          </div>
        )}
      </div>
    </div>
  );
}

// Tool call rendered as a green monospace block — matches the demo screenshot
// styling: `tool.name(args)` on top in cyan, → result/summary in green below.
function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const argsLine = formatArgsLine(tc.args);
  const resultSummary = summarizeResult(tc.result, tc.error);
  const status = tc.error ? "error" : tc.result !== undefined ? "ok" : "pending";

  return (
    <div className="rounded-md border border-line bg-[#0a0d12] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed overflow-x-auto">
      <div className="flex items-start gap-1.5">
        <Wrench className="size-3 mt-0.5 text-brand-cyan shrink-0" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <div className="text-brand-cyan whitespace-pre-wrap break-all">
            <span className="text-brand-blue-2">{tc.name}</span>
            <span className="text-ink-2">{argsLine}</span>
          </div>
          {resultSummary && (
            <div
              className={
                "mt-0.5 whitespace-pre-wrap break-all " +
                (status === "error" ? "text-brand-red" : "text-brand-green")
              }
            >
              → {resultSummary}
            </div>
          )}
        </div>
        {status === "pending" && (
          <span className="text-[10px] text-ink-3 shrink-0 animate-pulse">…</span>
        )}
      </div>
    </div>
  );
}

function formatArgsLine(args: unknown): string {
  if (!args || typeof args !== "object") return "()";
  const entries = Object.entries(args as Record<string, unknown>);
  if (!entries.length) return "()";
  const parts = entries.slice(0, 4).map(([k, v]) => {
    let s: string;
    if (typeof v === "string") s = `"${v.length > 60 ? v.slice(0, 60) + "…" : v}"`;
    else if (typeof v === "number" || typeof v === "boolean") s = String(v);
    else if (Array.isArray(v)) s = `[${v.length}]`;
    else s = `{…}`;
    return `${k}=${s}`;
  });
  if (entries.length > 4) parts.push("…");
  return `(${parts.join(", ")})`;
}

function summarizeResult(result: unknown, error: string | undefined): string {
  if (error) return error.length > 200 ? error.slice(0, 200) + "…" : error;
  if (result === undefined || result === null) return "";
  if (typeof result === "string") return result.length > 200 ? result.slice(0, 200) + "…" : result;
  if (typeof result !== "object") return String(result);
  const r = result as Record<string, unknown>;
  // Common result shapes — pick the most informative summary.
  if (typeof r.title === "string") return String(r.title);
  if (Array.isArray(r.results)) return `${r.results.length} résultats`;
  if (Array.isArray(r.leads)) return `${r.leads.length} leads trouvés`;
  if (Array.isArray(r.candidates)) return `${r.candidates.length} candidats`;
  if (Array.isArray(r.events)) return `${r.events.length} évènements`;
  if (Array.isArray(r.charges)) return `${r.charges.length} paiements`;
  if (Array.isArray(r.messages)) return `${r.messages.length} messages`;
  if (Array.isArray(r.hits)) return `${r.hits.length} résultats`;
  if (typeof r.text === "string") {
    return r.text.length > 200 ? r.text.slice(0, 200) + "…" : r.text;
  }
  if (typeof r.handed_off === "boolean") {
    return r.handed_off
      ? `relais → ${String(r.target_agent_name ?? "agent")}`
      : `relais refusé : ${String(r.error ?? "?")}`;
  }
  if (typeof r.delivered === "boolean") return r.delivered ? "envoyé ✓" : "non envoyé";
  if (typeof r.confirmed === "boolean") return r.confirmed ? "réservé ✓" : "non confirmé";
  if (typeof r.ok === "boolean") return r.ok ? "ok" : `erreur : ${String(r.error ?? "?")}`;
  // Fallback — show keys, not [object Object].
  const keys = Object.keys(r).slice(0, 4);
  return `{ ${keys.join(", ")}${Object.keys(r).length > 4 ? ", …" : ""} }`;
}
