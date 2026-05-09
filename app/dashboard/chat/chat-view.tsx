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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Agent {
  id: string;
  name: string;
  templateSlug: string;
  status: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: { name: string; templateSlug: string };
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

export function ChatView({
  userName,
  agents,
}: {
  userName: string;
  agents: Agent[];
}) {
  const [activeAgent, setActiveAgent] = useState<Agent | null>(
    agents[0] ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || !activeAgent || streaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      agent: { name: activeAgent.name, templateSlug: activeAgent.templateSlug },
      pending: true,
    };

    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgent.id,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200) || "no body"}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Parse Vercel AI SDK data stream: lines like `0:"text"`, `2:[...]`, etc.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const m = line.match(/^(\w+):(.*)$/);
          if (!m) continue;
          const tag = m[1];
          const payload = m[2];
          if (tag === "0") {
            // text chunk — JSON-encoded string
            try {
              acc += JSON.parse(payload);
              setMessages((prev) =>
                prev.map((p) =>
                  p.id === assistantMsg.id ? { ...p, content: acc, pending: true } : p,
                ),
              );
            } catch {
              /* swallow malformed chunk */
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((p) =>
          p.id === assistantMsg.id ? { ...p, content: acc, pending: false } : p,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setMessages((prev) =>
        prev.map((p) =>
          p.id === assistantMsg.id
            ? {
                ...p,
                content: `⚠ ${msg}`,
                pending: false,
              }
            : p,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  const headerInitials = useMemo(
    () => (userName[0] ?? "U").toUpperCase(),
    [userName],
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
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Chat</h1>
        <p className="text-ink-2 text-sm mt-1">
          Donnez un objectif. Votre agent appellera ses outils en direct.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
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
              placeholder={`Donnez un objectif à ${activeAgent?.name?.split(" ")[0] ?? "l'agent"}…`}
              disabled={streaming}
              className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-ink-3 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="size-9 rounded-md bg-gradient-to-br from-[#5B6CFF] to-[#22D3EE] text-white shadow-[0_4px_16px_rgba(91,108,255,.4)] hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-40"
              aria-label="Envoyer"
            >
              <Send className="size-4" strokeWidth={2.2} />
            </button>
          </form>
        </div>
      </div>
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
              en train d&apos;écrire…
            </span>
          ) : null}
        </div>
        <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
          {msg.content || (msg.pending ? <span className="text-ink-3">…</span> : null)}
        </div>
        {msg.content.startsWith("⚠") ? (
          <div className="mt-2 text-[11px] text-brand-red flex items-center gap-1.5">
            <AlertCircle className="size-3" />
            Erreur — vérifiez ANTHROPIC_API_KEY ou OPENAI_API_KEY dans Vercel.
          </div>
        ) : null}
      </div>
    </div>
  );
}
