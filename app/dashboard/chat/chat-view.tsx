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
import { runWithPuter, isPuterAvailable } from "@/lib/agents/puter-runtime";

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
}: {
  userName: string;
  agents: Agent[];
  orgStats: OrgStats;
}) {
  const [activeAgent, setActiveAgent] = useState<Agent | null>(agents[0] ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [puterReady, setPuterReady] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

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

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || !activeAgent || running) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      agent: { name: activeAgent.name, templateSlug: activeAgent.templateSlug },
      toolCalls: [],
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    const objective = input.trim();
    setInput("");
    setRunning(true);

    try {
      const result = await runWithPuter({
        agentId: activeAgent.id,
        templateSlug: activeAgent.templateSlug,
        systemPrompt:
          activeAgent.systemPrompt ??
          "Tu es un agent autonome qui exécute des objectifs en appelant les outils mis à ta disposition. Sois concis et actionnable.",
        enabledTools: activeAgent.enabledTools ?? [],
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur Puter";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠ ${msg}`, pending: false }
            : m,
        ),
      );
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

  // Agents currently in play = picked + any whose tool was just used.
  const agentsInPlay = useMemo(() => {
    const ids = new Set<string>();
    if (activeAgent) ids.add(activeAgent.id);
    return agents.filter((a) => ids.has(a.id) || a.status === "running");
  }, [agents, activeAgent]);

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
          <h1 className="text-3xl font-medium tracking-tight">Chat</h1>
          <p className="text-ink-2 text-sm mt-1">
            Donnez un objectif. L&apos;agent appelle ses outils en direct.
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
              <div className="font-medium text-sm">{activeAgent?.name}</div>
              <div className="text-[11px] font-mono text-ink-3">
                {activeAgent?.status}
              </div>
            </div>
          </div>

          <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {messages.length === 0 ? (
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
          <div className="text-sm font-medium mb-1.5">{userName}</div>
          <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }
  const Icon = iconFor(msg.agent?.templateSlug ?? "");
  const hasError = msg.content.startsWith("⚠");
  return (
    <div className="flex gap-3">
      <span
        className={`size-8 rounded-full bg-gradient-to-br ${gradientFor(msg.agent?.templateSlug ?? "")} text-white flex items-center justify-center shrink-0`}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium mb-1.5">
          {msg.agent?.name ?? "Agent"}
          {msg.pending ? (
            <span className="ml-2 text-[10px] font-mono text-ink-3 animate-pulse">
              {msg.toolCalls?.length
                ? `${msg.toolCalls.length} outil${msg.toolCalls.length > 1 ? "s" : ""} appelé${msg.toolCalls.length > 1 ? "s" : ""}…`
                : "réfléchit…"}
            </span>
          ) : null}
        </div>

        {msg.toolCalls && msg.toolCalls.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {msg.toolCalls.map((tc, i) => (
              <div
                key={i}
                className="rounded-md border border-line bg-bg-3 p-2.5 font-mono text-[11px] leading-relaxed"
              >
                <div className="flex items-center gap-1.5 text-brand-blue-2">
                  <Wrench className="size-3" strokeWidth={2} />
                  {tc.name}
                  {tc.error ? (
                    <span className="ml-auto text-brand-red text-[10px]">erreur</span>
                  ) : tc.result !== undefined ? (
                    <span className="ml-auto text-brand-green text-[10px]">ok</span>
                  ) : (
                    <span className="ml-auto text-ink-3 text-[10px]">en cours…</span>
                  )}
                </div>
                {tc.error ? (
                  <div className="text-brand-red mt-1 break-all">{tc.error}</div>
                ) : tc.result !== undefined ? (
                  <div className="text-ink-3 mt-1 truncate">
                    {JSON.stringify(tc.result).slice(0, 200)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {msg.content && (
          <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
        )}

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
