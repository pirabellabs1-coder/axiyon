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
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-start gap-2.5 text-xs py-2 border-b border-line last:border-0"
        >
          <ItemIcon item={it} />
          <div className="flex-1 min-w-0">
            <div className="text-ink-2">
              {it.agent ? (
                <>
                  <span className="font-medium text-brand-blue-2">{it.agent.name}</span>{" "}
                </>
              ) : null}
              <span className="text-ink-3">{verbForKind(it)}</span>
            </div>
            <div className="text-ink truncate">{it.text}</div>
          </div>
          <span className="text-ink-3 text-[10px] font-mono shrink-0">
            {relAge(new Date(it.at))}
          </span>
        </li>
      ))}
      {error ? (
        <li className="text-[10px] text-brand-red font-mono">⚠ {error}</li>
      ) : null}
    </ul>
  );
}

function ItemIcon({ item }: { item: FeedItem }) {
  if (item.kind === "task" && item.agent) {
    const grad =
      TEMPLATE_GRADIENTS[item.agent.slug] ?? "from-[#5B6CFF] to-[#22D3EE]";
    return (
      <span
        className={`size-7 rounded-md bg-gradient-to-br ${grad} text-white flex items-center justify-center shrink-0`}
      >
        <Bot className="size-3.5" strokeWidth={2} />
      </span>
    );
  }
  // Audit / system events
  const isApproval = /approval/.test(item.text.toLowerCase());
  const isHandoff = /handoff/.test(item.text.toLowerCase());
  const isIntegration = /int[ée]gration/.test(item.text.toLowerCase());
  const Icon = isHandoff ? Workflow : isApproval ? ShieldCheck : isIntegration ? Plug : Activity;
  return (
    <span className="size-7 rounded-md bg-bg-3 border border-line text-ink-2 flex items-center justify-center shrink-0">
      <Icon className="size-3.5" strokeWidth={2} />
    </span>
  );
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
