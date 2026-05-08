"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATALOG } from "@/lib/agents/catalog";
import { cn } from "@/lib/utils";

interface AgentLite {
  id: string;
  name: string;
  templateSlug: string;
  status: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatClient({ agents }: { agents: AgentLite[] }) {
  const [agentId, setAgentId] = useState<string | undefined>(agents[0]?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  if (agents.length === 0) {
    return (
      <div className="card p-12 text-center space-y-4 m-auto max-w-lg">
        <div className="text-5xl">🤖</div>
        <p className="text-ink-2">
          Vous devez d'abord recruter un agent pour discuter avec lui.
        </p>
        <Button asChild variant="glow">
          <Link href="/dashboard/agents/hire">Recruter un agent →</Link>
        </Button>
      </div>
    );
  }

  const activeAgent = agents.find((a) => a.id === agentId);
  const template = activeAgent ? CATALOG[activeAgent.templateSlug] : undefined;

  async function send() {
    if (!input.trim() || loading || !template) return;
    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input };
    const draftMsgs = [...messages, userMsg];
    setMessages(draftMsgs);
    setInput("");
    setLoading(true);

    try {
      // Wait for puter to be ready
      const t0 = Date.now();
      while (!window.puter?.ai && Date.now() - t0 < 5000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!window.puter?.ai) throw new Error("Puter.js indisponible — autorise js.puter.com.");

      const history = draftMsgs.map((m) => ({ role: m.role, content: m.content }));
      const sysPrompt = template.systemPrompt;

      const resp = (await window.puter.ai.chat(
        [{ role: "system", content: sysPrompt }, ...history] as never,
        { model: "claude-sonnet-4-5", stream: true },
      )) as AsyncIterable<{ text?: string }>;

      const id = crypto.randomUUID();
      setMessages((prev) => [...prev, { id, role: "assistant", content: "" }]);
      let acc = "";
      for await (const chunk of resp) {
        const piece = chunk?.text ?? "";
        if (!piece) continue;
        acc += piece;
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: acc } : m)),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 flex-1 min-h-0">
      {/* Agent picker */}
      <div className="card p-3 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-wider font-mono text-ink-3 px-2 py-2">
          Agents
        </div>
        <div className="flex flex-col gap-1">
          {agents.map((a) => {
            const tpl = CATALOG[a.templateSlug];
            return (
              <button
                key={a.id}
                onClick={() => {
                  setAgentId(a.id);
                  setMessages([]);
                  setError(null);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
                  agentId === a.id ? "bg-bg-3 text-ink" : "text-ink-2 hover:bg-bg-3",
                )}
              >
                <span className="text-base">{tpl?.icon ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.name}</div>
                  <div className="text-xs text-ink-3 truncate">
                    {tpl?.role ?? a.templateSlug}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 px-2 py-2 text-[10px] text-brand-green font-mono leading-relaxed">
          ● Powered by Puter
          <br />
          <span className="text-ink-3">
            Claude Sonnet 4.5 · gratuit · illimité
          </span>
        </div>
      </div>

      {/* Conversation */}
      <div className="card p-0 flex flex-col overflow-hidden min-h-[500px]">
        <div className="px-5 py-3 border-b border-line flex items-center gap-3">
          <div className="size-9 rounded-md bg-bg-3 border border-line flex items-center justify-center text-base">
            {template?.icon ?? "🤖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{activeAgent?.name}</div>
            <div className="text-xs text-ink-2">{template?.role ?? "AI agent"}</div>
          </div>
          <span className="text-xs text-brand-green font-mono">● live · puter</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-ink-3 text-sm pt-12">
              Démarrez la conversation. L'agent vous répond gratuitement via{" "}
              <a
                href="https://puter.com"
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue-2 hover:underline"
              >
                Puter
              </a>{" "}
              (Claude Sonnet 4.5).
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-3 animate-in", m.role === "user" && "justify-end")}
              >
                {m.role !== "user" && (
                  <div className="size-7 rounded-md bg-grad text-white flex items-center justify-center text-xs font-semibold shrink-0">
                    {template?.icon ?? "A"}
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-md px-3 py-2 text-sm leading-relaxed max-w-[80%] whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-brand-blue/15 border border-brand-blue/30"
                      : "bg-bg-3 border border-line",
                  )}
                >
                  {m.content || (m.role === "assistant" && loading ? "…" : "")}
                </div>
                {m.role === "user" && (
                  <div className="size-7 rounded-md bg-bg-3 border border-line text-xs flex items-center justify-center shrink-0">
                    Vous
                  </div>
                )}
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="size-7 rounded-md bg-grad text-white flex items-center justify-center text-xs font-semibold shrink-0">
                {template?.icon ?? "A"}
              </div>
              <div className="rounded-md bg-bg-3 border border-line px-3 py-2 text-sm text-ink-2">
                <Loader2 className="inline-block size-3 animate-spin" /> rédige…
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 py-3 border-t border-line text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="border-t border-line p-3 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Demandez à l'agent…"
            rows={1}
            className="flex-1 rounded-md bg-bg-3 border border-line px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue resize-none max-h-32"
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} variant="glow" size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
