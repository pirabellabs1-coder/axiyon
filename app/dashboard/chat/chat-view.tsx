"use client";

import { useEffect, useRef, useState } from "react";
import {
  Phone,
  Briefcase,
  Scale,
  Headphones,
  TrendingUp,
  UserSearch,
  Cog,
  AlertTriangle,
} from "lucide-react";

// ─── Agents ─────────────────────────────────────────────────────────
const AGENTS: Record<
  string,
  { letter: string; gradient: string; role: string }
> = {
  Iris:  { letter: "I", gradient: "from-[#5B6CFF] to-[#22D3EE]", role: "SDR Outbound" },
  Atlas: { letter: "A", gradient: "from-[#FF3D8E] to-[#5B6CFF]", role: "CFO Adjoint" },
  Sage:  { letter: "S", gradient: "from-[#22D3EE] to-[#34D399]", role: "Support N2" },
  Codex: { letter: "C", gradient: "from-[#E8B86D] to-[#FF3D8E]", role: "Juriste" },
  Lumen: { letter: "L", gradient: "from-[#34D399] to-[#22D3EE]", role: "Marketing" },
  Forge: { letter: "F", gradient: "from-[#5A5A6E] to-[#7C8AFF]", role: "DevOps" },
  Nova:  { letter: "N", gradient: "from-[#FF3D8E] to-[#E8B86D]", role: "Recruteuse" },
};

// ─── Scripted demo conversation (matches the public demo) ────────────
type Tool = [string, string]; // [command, result]
type Msg = {
  who: "user" | "agent";
  agent?: string;
  text: string;
  tools?: Tool[];
  time: string;
};

const SCRIPT: Msg[] = [
  {
    who: "user",
    text:
      '"Trouve 50 prospects ICP cette semaine, qualifie-les, et organise des démos — uniquement avec ceux dont la marge attendue dépasse 80k€."',
    time: "14:23",
  },
  {
    who: "agent",
    agent: "Iris",
    text:
      "D'accord. Je sources sur LinkedIn et Apollo, je délègue l'analyse de marge à Atlas, et je booke avec ceux qui passent.",
    tools: [['linkedin.search(icp="VP Data, Series B+, Europe", n=180)', "→ 184 candidats trouvés"]],
    time: "14:23",
  },
  {
    who: "agent",
    agent: "Iris",
    text: "Enrichissement Apollo terminé. J'envoie la liste à Atlas pour qualification.",
    tools: [["apollo.enrich(184 leads)", "→ enrichis · domaines, ARR, stack"]],
    time: "14:23",
  },
  {
    who: "agent",
    agent: "Atlas",
    text:
      "Sur les 184, 67 ont un budget data > 200k€/an. Marge brute estimée : 71-94k€. Je priorise les 51 meilleurs et les passe à Iris.",
    tools: [["model.predict(margin_v2, threshold=80000)", "→ 67 passent · top 51 priorisés"]],
    time: "14:24",
  },
  {
    who: "agent",
    agent: "Iris",
    text:
      "Séquence d'outreach lancée : LinkedIn + email personnalisé. Je vous mets à jour à chaque démo bookée.",
    tools: [["email.send(51 prospects)", "→ délivrés · 6 réponses positives"]],
    time: "14:24",
  },
  {
    who: "agent",
    agent: "Iris",
    text:
      "6 démos confirmées sur ton calendrier mardi-jeudi. Stripe (240k€), Notion (180k€), Linear (120k€), 3 autres en cours de qualif. ✅",
    time: "14:27",
  },
  {
    who: "agent",
    agent: "Codex",
    text:
      "Le deal Stripe dépasse le seuil de 100k€. J'ai préparé le contrat MSA + DPA + NDA. Approbation humaine demandée avant signature.",
    time: "14:28",
  },
];

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Iris: Phone,
  Atlas: Briefcase,
  Sage: Headphones,
  Codex: Scale,
  Lumen: TrendingUp,
  Forge: Cog,
  Nova: UserSearch,
};

// ─── View ────────────────────────────────────────────────────────────

export function ChatView({ userName }: { userName: string }) {
  const [shown, setShown] = useState<Msg[]>([]);
  const [composer, setComposer] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Reveal scripted messages progressively for the "live" feel.
  useEffect(() => {
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled || i >= SCRIPT.length) return;
      const msg = SCRIPT[i]; // capture BEFORE incrementing
      i++;
      if (!msg) return;
      setShown((prev) => [...prev, msg]);
      setTimeout(tick, 1200 + Math.random() * 800);
    };
    const t = setTimeout(tick, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown]);

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!composer.trim()) return;
    const newMsg: Msg = { who: "user", text: composer.trim(), time: nowHM() };
    setShown((prev) => [...prev, newMsg]);
    setComposer("");
    // Iris auto-replies after a short delay
    setTimeout(() => {
      setShown((prev) => [
        ...prev,
        {
          who: "agent",
          agent: "Iris",
          text: "Bien reçu. Je m'en occupe et je vous tiens au courant.",
          time: nowHM(),
        },
      ]);
    }, 900);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Conversation avec vos agents</h1>
        <p className="text-ink-2 text-sm mt-1">Donnez un objectif. Vos agents s'organisent.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Main chat */}
        <div className="rounded-xl border border-line bg-bg-2 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line bg-bg-3/40">
            <span className="size-8 rounded-md bg-gradient-to-br from-[#FF3D8E] to-[#5B6CFF] flex items-center justify-center text-white text-sm font-semibold">
              A
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Workflow · Deal Flow Hebdo</div>
              <div className="text-[11px] text-ink-3 font-mono">
                3 agents · démarré il y a 4 min
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-brand-green">
              <span className="size-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(52,211,153,.6)]" />
              LIVE
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {shown.filter(Boolean).map((m, i) => (
              <Message key={i} msg={m} userName={userName} />
            ))}
          </div>

          {/* Composer */}
          <form onSubmit={send} className="border-t border-line bg-bg-3/40 px-4 py-3 flex gap-2">
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Donnez un nouvel objectif à vos agents…"
              className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-ink-3"
            />
            <button
              type="submit"
              className="size-9 rounded-md bg-gradient-to-br from-[#5B6CFF] to-[#22D3EE] text-white shadow-[0_4px_16px_rgba(91,108,255,.4)] hover:opacity-90 transition-opacity flex items-center justify-center text-lg leading-none"
              aria-label="Envoyer"
            >
              →
            </button>
          </form>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <SidePanel title="Agents en jeu">
            <AgentRow name="Iris" status="running" detail="SDR · sourcing en cours" />
            <AgentRow name="Atlas" status="running" detail="CFO · qualification marges" />
            <AgentRow name="Codex" status="idle" detail="Juriste · prêt si contrat" />
          </SidePanel>

          <SidePanel title="Outils utilisés">
            <KV k="linkedin.search" v="184" />
            <KV k="apollo.enrich" v="184" />
            <KV k="crm.create_lead" v="51" />
            <KV k="calendar.book" v="6" />
            <KV k="salesforce.update" v="51" />
          </SidePanel>

          <SidePanel title="Budget consommé">
            <KV k="Tâches" v="428 / 1 000" />
            <KV k="Coût" v="8,56 € / 20 €" />
            <KV k="Voice min" v="12 / 60" />
            <div className="mt-3 h-1 rounded-full bg-bg-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#5B6CFF] to-[#22D3EE]"
                style={{ width: "43%" }}
              />
            </div>
          </SidePanel>

          <SidePanel title="Approbations">
            <div className="rounded-md border border-brand-yellow/40 bg-brand-yellow/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-mono text-brand-yellow">
                <AlertTriangle className="size-3.5" />
                1 en attente
              </div>
              <div className="text-xs text-ink leading-relaxed">
                Codex demande de signer le contrat <strong>Stripe</strong> · 240 k€
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 text-xs px-3 py-1.5 rounded-md border border-line bg-bg-3 text-ink-2 hover:text-ink hover:border-line-2 transition"
                >
                  Refuser
                </button>
                <button
                  type="button"
                  className="flex-1 text-xs px-3 py-1.5 rounded-md bg-gradient-to-br from-[#5B6CFF] to-[#22D3EE] text-white font-medium shadow-[0_4px_16px_rgba(91,108,255,.4)]"
                >
                  Approuver
                </button>
              </div>
            </div>
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function Message({ msg, userName }: { msg: Msg; userName: string }) {
  if (!msg) return null;
  if (msg.who === "user") {
    return (
      <div className="flex gap-3">
        <span className="size-8 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#22D3EE] text-white text-xs font-semibold flex items-center justify-center shrink-0">
          {(userName[0] ?? "U").toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-medium text-sm">{userName}</span>
            <span className="text-[10px] text-ink-3 font-mono ml-auto">{msg.time}</span>
          </div>
          <div className="text-sm text-ink leading-relaxed">{msg.text}</div>
        </div>
      </div>
    );
  }

  const key = msg.agent ?? "Iris";
  const a = AGENTS[key] ?? AGENTS.Iris;
  const Icon = ICONS[key] ?? Phone;
  return (
    <div className="flex gap-3">
      <span
        className={`size-8 rounded-full bg-gradient-to-br ${a.gradient} text-white flex items-center justify-center shrink-0`}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-medium text-sm">{msg.agent}</span>
          <span className="text-[10px] uppercase tracking-wider font-mono text-ink-3 px-1.5 py-0.5 rounded bg-bg-3 border border-line">
            {a.role}
          </span>
          <span className="text-[10px] text-ink-3 font-mono ml-auto">{msg.time}</span>
        </div>
        <div className="text-sm text-ink leading-relaxed">{msg.text}</div>
        {msg.tools?.length ? (
          <div className="mt-3 space-y-1.5">
            {msg.tools.map((t, i) => (
              <div
                key={i}
                className="rounded-md border border-line bg-bg-3 p-2.5 font-mono text-[11px] leading-relaxed"
              >
                <div className="text-brand-blue-2">{t[0]}</div>
                <div className="text-brand-green mt-0.5">{t[1]}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-ink-3 mb-3">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AgentRow({
  name,
  status,
  detail,
}: {
  name: string;
  status: "running" | "idle";
  detail: string;
}) {
  const a = AGENTS[name] ?? AGENTS.Iris;
  const Icon = ICONS[name] ?? Phone;
  return (
    <div className="rounded-md border border-line bg-bg-3 p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`size-6 rounded bg-gradient-to-br ${a.gradient} text-white flex items-center justify-center shrink-0`}
        >
          <Icon className="size-3" strokeWidth={2} />
        </span>
        <strong className="text-sm">{name}</strong>
        <span
          className={`ml-auto size-2 rounded-full ${
            status === "running"
              ? "bg-brand-green shadow-[0_0_6px_rgba(52,211,153,.6)]"
              : "bg-ink-3"
          }`}
        />
      </div>
      <div className="text-[11px] text-ink-2">{detail}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="font-mono text-ink-3">{k}</span>
      <span className="font-mono text-ink">{v}</span>
    </div>
  );
}

function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
