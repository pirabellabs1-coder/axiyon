"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Workflow, ShieldCheck, Bot, Plug } from "lucide-react";

export interface FeedItem {
  id: string;
  kind: "task" | "audit";
  at: string;
  text: string;
  agent?: { name: string; slug: string };
  status?: string;
}

export function LiveActivity({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set(initial.map((i) => i.id)));

  useEffect(() => {
    let cancelled = false;
    let lastFetch = new Date(Date.now() - 60_000).toISOString();

    async function tick() {
      try {
        const r = await fetch(
          `/api/v1/activity?since=${encodeURIComponent(lastFetch)}&limit=20`,
          { cache: "no-store" },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { serverTime: string; items: FeedItem[] };
        if (cancelled) return;

        const fresh = data.items.filter((i) => !seenRef.current.has(i.id));
        if (fresh.length) {
          for (const i of fresh) seenRef.current.add(i.id);
          setItems((prev) => {
            const merged = [...fresh, ...prev];
            // dedupe + cap
            const seen = new Set<string>();
            const out: FeedItem[] = [];
            for (const it of merged) {
              if (seen.has(it.id)) continue;
              seen.add(it.id);
              out.push(it);
              if (out.length >= 20) break;
            }
            return out;
          });
        }
        lastFetch = data.serverTime;
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "fetch error");
      }
    }

    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-3 text-center py-8">
        Aucune activité pour l&apos;instant.
        {error ? <span className="block text-[10px] mt-1 text-brand-red">⚠ {error}</span> : null}
      </p>
    );
  }

  return (
    <div className="feed">
      {items.map((it) => {
        const cls = it.agent ? FEED_AGENT_CLASS[it.agent.slug] ?? "default" : "default";
        return (
          <div key={it.id} className="feed-item">
            <div className={`feed-icon ${cls}`}>
              <FeedSvg item={it} />
            </div>
            <div className="feed-content">
              <div className="feed-line">
                {it.agent ? <span className="agent">{it.agent.name}</span> : null}
                {it.agent ? " " : null}
                <span className="action">{verbForKind(it)}</span>{" "}
                <strong>{it.text}</strong>
              </div>
              <div className="feed-time">il y a {relAge(new Date(it.at))}</div>
            </div>
          </div>
        );
      })}
      {error ? (
        <div className="text-[10px] text-brand-red font-mono">⚠ {error}</div>
      ) : null}
    </div>
  );
}

// Map template slug → CSS modifier class for the feed-icon gradient.
const FEED_AGENT_CLASS: Record<string, string> = {
  "sdr-outbound": "iris",
  "cfo-assistant": "atlas",
  "support-l2": "sage",
  "legal-counsel": "codex",
  "recruiter": "nova",
  "devops": "forge",
  "growth-marketer": "lumen",
  "inbox-manager": "inbox",
};

function FeedSvg({ item }: { item: FeedItem }) {
  // Pick an SVG path based on agent template (or a generic Activity icon for audit events).
  if (item.kind === "audit") {
    const txt = item.text.toLowerCase();
    if (/handoff/.test(txt)) return <Workflow className="size-4" strokeWidth={2} />;
    if (/approbation|approval/.test(txt)) return <ShieldCheck className="size-4" strokeWidth={2} />;
    if (/int[ée]gration/.test(txt)) return <Plug className="size-4" strokeWidth={2} />;
    return <Activity className="size-4" strokeWidth={2} />;
  }
  return <Bot className="size-4" strokeWidth={2} />;
}

function verbForKind(it: FeedItem): string {
  if (it.kind === "task") {
    if (it.status === "succeeded") return "a terminé";
    if (it.status === "failed") return "a échoué sur";
    if (it.status === "running") return "exécute";
    if (it.status === "queued") return "a reçu";
    return "exécute";
  }
  return "";
}

function relAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 30) return "à l'instant";
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const j = Math.round(h / 24);
  return `${j}j`;
}
