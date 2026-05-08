"use client";
import { useChat } from "ai/react";
import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CATALOG } from "@/lib/agents/catalog";
import { cn } from "@/lib/utils";

interface AgentLite {
  id: string;
  name: string;
  templateSlug: string;
  status: string;
}

export function ChatClient({ agents }: { agents: AgentLite[] }) {
  const [agentId, setAgentId] = useState<string | undefined>(agents[0]?.id);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } =
    useChat({
      api: "/api/chat",
      body: { agentId },
    });

  if (agents.length === 0) {
    return (
      <div className="card p-12 text-center space-y-4 m-auto max-w-lg">
        <div className="text-5xl">🤖</div>
        <p className="text-ink-2">Vous devez d'abord recruter un agent pour discuter avec lui.</p>
        <Button asChild variant="glow">
          <Link href="/dashboard/agents/hire">Recruter un agent →</Link>
        </Button>
      </div>
    );
  }

  const activeAgent = agents.find((a) => a.id === agentId);
  const template = activeAgent ? CATALOG[activeAgent.templateSlug] : undefined;

  return (
    <div className="grid grid-cols-[260px_1fr] gap-4 flex-1 min-h-0">
      {/* Agent picker */}
      <div className="card p-3 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-wider font-mono text-ink-3 px-2 py-2">
          Agents
        </div>
        <div className="flex flex-col gap-1">
          {agents.map((a) => {
            const t = CATALOG[a.templateSlug];
            return (
              <button
                key={a.id}
                onClick={() => {
                  setAgentId(a.id);
                  setMessages([]);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
                  agentId === a.id ? "bg-bg-3 text-ink" : "text-ink-2 hover:bg-bg-3",
                )}
              >
                <span className="text-base">{t?.icon ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.name}</div>
                  <div className="text-xs text-ink-3 truncate">{t?.role ?? a.templateSlug}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation */}
      <div className="card p-0 flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center gap-3">
          <div className="size-9 rounded-md bg-bg-3 border border-line flex items-center justify-center text-base">
            {template?.icon ?? "🤖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{activeAgent?.name}</div>
            <div className="text-xs text-ink-2">{template?.role ?? "AI agent"}</div>
          </div>
          <span className="text-xs text-brand-green font-mono">● live</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-ink-3 text-sm pt-12">
              Commencez la conversation. Posez n'importe quelle question — l'agent peut appeler ses outils.
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
                  {m.content}
                  {m.toolInvocations && m.toolInvocations.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-ink-2">
                        {m.toolInvocations.length} appel(s) d'outil
                      </summary>
                      <ul className="mt-2 space-y-1 font-mono">
                        {m.toolInvocations.map((ti) => (
                          <li key={ti.toolCallId} className="text-brand-cyan">
                            {ti.toolName}({JSON.stringify(ti.args).slice(0, 100)})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="size-7 rounded-md bg-bg-3 border border-line text-xs flex items-center justify-center shrink-0">
                    Vous
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="size-7 rounded-md bg-grad" />
              <div className="rounded-md bg-bg-3 border border-line px-3 py-2 text-sm text-ink-2">
                <span className="inline-block animate-pulse">…</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 py-3 border-t border-line text-xs text-destructive">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-line p-3 flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Demandez à l'agent…"
            className="flex-1 rounded-md bg-bg-3 border border-line px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} variant="glow">
            Envoyer →
          </Button>
        </form>
      </div>
    </div>
  );
}
