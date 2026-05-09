import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Phone, Briefcase, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

const NODES = [
  {
    status: "done" as const,
    statusLabel: "DONE",
    Icon: Phone,
    gradient: "from-[#5B6CFF] to-[#22D3EE]",
    title: "Iris · Source leads",
    meta: "11s · 184 leads",
    body: 'LinkedIn + Apollo · ICP "VP Data, Series B+, Europe" · n=180',
  },
  {
    status: "done" as const,
    statusLabel: "DONE",
    Icon: Briefcase,
    gradient: "from-[#FF3D8E] to-[#5B6CFF]",
    title: "Atlas · Qualify margin",
    meta: "8s · 67 retenus",
    body: "Marge brute estimée > 80 k€ · 67/184 passent · 51 prioritaires",
  },
  {
    status: "active" as const,
    statusLabel: "EN COURS",
    Icon: Phone,
    gradient: "from-[#5B6CFF] to-[#22D3EE]",
    title: "Iris · Book demos",
    meta: "3 min 22s · 6/51",
    body: "Outreach LinkedIn + email · taux de réponse 11,8% · 6 démos confirmées",
  },
  {
    status: "pending" as const,
    statusLabel: "EN ATTENTE",
    Icon: Scale,
    gradient: "from-[#E8B86D] to-[#FF3D8E]",
    title: "Codex · Prepare contracts",
    meta: "déclenché si signature",
    body: "Pour chaque deal qualifié, prépare NDA + contrat + DPA · approbation humaine ≥ 100 k€",
  },
];

const TRACE = [
  { t: "14:23:11.482", body: <>iris.<span className="text-brand-cyan">linkedin.search</span>(<span className="text-brand-yellow">icp</span>=<span className="text-brand-green">{`"VP Data, Series B+"`}</span>, <span className="text-brand-yellow">n</span>=<span className="text-brand-magenta">180</span>) → <span className="text-brand-green">184 results</span></> },
  { t: "14:23:18.913", body: <>iris.<span className="text-brand-cyan">apollo.enrich</span>(<span className="text-brand-yellow">leads</span>=<span className="text-brand-magenta">184</span>) → <span className="text-brand-green">184 enriched</span></> },
  { t: "14:23:22.001", body: <>iris.<span className="text-brand-cyan">handoff</span>(<span className="text-brand-yellow">to</span>=<span className="text-brand-green">{`"atlas"`}</span>, <span className="text-brand-yellow">action</span>=<span className="text-brand-green">{`"qualify_margin"`}</span>)</> },
  { t: "14:23:30.144", body: <>atlas.<span className="text-brand-cyan">salesforce.lookup</span>(<span className="text-brand-yellow">accounts</span>=<span className="text-brand-magenta">184</span>) → <span className="text-brand-green">184 records</span></> },
  { t: "14:23:31.982", body: <>atlas.<span className="text-brand-cyan">model.predict</span>(<span className="text-brand-yellow">model</span>=<span className="text-brand-green">{`"margin_v2"`}</span>, <span className="text-brand-yellow">threshold</span>=<span className="text-brand-magenta">80000</span>) → <span className="text-brand-green">67 passed</span></> },
  { t: "14:23:32.117", body: <>atlas.<span className="text-brand-cyan">handoff</span>(<span className="text-brand-yellow">to</span>=<span className="text-brand-green">{`"iris"`}</span>, <span className="text-brand-yellow">action</span>=<span className="text-brand-green">{`"book_demo"`}</span>, <span className="text-brand-yellow">leads</span>=<span className="text-brand-magenta">51</span>)</> },
  { t: "14:24:02.553", body: <>iris.<span className="text-brand-cyan">email.send</span>(<span className="text-brand-yellow">to</span>=<span className="text-brand-green">{`"sarah.chen@stripe.com"`}</span>, <span className="text-brand-yellow">template</span>=<span className="text-brand-green">{`"sdr_outreach_v7"`}</span>) → <span className="text-brand-green">delivered</span></> },
  { t: "14:25:14.298", body: <>iris.<span className="text-brand-cyan">calendar.book</span>(<span className="text-brand-yellow">slot</span>=<span className="text-brand-green">{`"2026-05-12T10:00"`}</span>, <span className="text-brand-yellow">attendees</span>=<span className="text-brand-magenta">2</span>) → <span className="text-brand-green">confirmed</span></> },
  { t: "14:25:14.512", body: <>iris.<span className="text-brand-cyan">salesforce.update</span>(<span className="text-brand-yellow">stage</span>=<span className="text-brand-green">{`"demo_booked"`}</span>) → <span className="text-brand-green">ok</span></> },
  { t: "14:25:15.001", body: <><span className="text-brand-blue-2">workflow.checkpoint</span>(<span className="text-brand-yellow">step</span>=<span className="text-brand-magenta">3</span>, <span className="text-brand-yellow">progress</span>=<span className="text-brand-magenta">11.8</span>%)</> },
  { t: "14:26:48.893", body: <>iris.<span className="text-brand-cyan">linkedin.message</span>(<span className="text-brand-yellow">to</span>=<span className="text-brand-green">{`"j.dupont@blablacar.com"`}</span>) → <span className="text-brand-green">sent</span></> },
  { t: "14:27:30.117", body: <><span className="text-brand-yellow">⏸ awaiting</span> Codex.approval (contract &gt; 100k€)</> },
];

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Workflow · Deal Flow Hebdo</h1>
          <p className="text-ink-2 text-sm mt-1">
            Démarré chaque lundi 09:00 · Iris → Atlas → Iris → Codex
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost">Replay</Button>
          <Button variant="ghost">Éditer</Button>
          <Button variant="glow">Exécuter maintenant</Button>
        </div>
      </div>

      {/* Canvas with grid pattern background */}
      <div className="relative rounded-xl border border-line bg-bg-2 overflow-hidden p-6 md:p-10">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-6 gap-y-8 items-center">
          {/* Row 1 */}
          <Node {...NODES[0]} />
          <Arrow />
          <Node {...NODES[1]} />
          {/* Row 2 */}
          <Node {...NODES[2]} />
          <Arrow />
          <Node {...NODES[3]} />
        </div>
      </div>

      {/* Trace */}
      <div className="rounded-xl border border-line bg-bg-2 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm font-medium">Trace d'exécution · 12 dernières actions</div>
          <div className="text-[11px] font-mono text-ink-3">Tout est rejouable · audit immuable</div>
        </div>
        <div className="space-y-1 font-mono text-[12px] leading-relaxed text-ink-2 overflow-x-auto">
          {TRACE.map((row, i) => (
            <div key={i} className="whitespace-nowrap">
              <span className="text-ink-3">{row.t}</span>
              <span className="text-ink-3"> · </span>
              {row.body}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Node({
  status,
  statusLabel,
  Icon,
  gradient,
  title,
  meta,
  body,
}: {
  status: "done" | "active" | "pending";
  statusLabel: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  gradient: string;
  title: string;
  meta: string;
  body: string;
}) {
  const ring =
    status === "done"
      ? "border-brand-green/60"
      : status === "active"
        ? "border-brand-blue ring-2 ring-brand-blue/20"
        : "border-line";
  const badge =
    status === "done"
      ? "bg-brand-green/10 text-brand-green border-brand-green/30"
      : status === "active"
        ? "bg-brand-blue/10 text-brand-blue-2 border-brand-blue/30"
        : "bg-bg-3 text-ink-3 border-line";
  return (
    <div className={`relative rounded-lg border bg-bg-2 p-4 ${ring}`}>
      <span
        className={`absolute -top-2 right-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${badge}`}
      >
        {statusLabel}
      </span>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span
          className={`size-8 rounded-md bg-gradient-to-br ${gradient} text-white flex items-center justify-center shrink-0`}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-[11px] font-mono text-ink-3">{meta}</div>
        </div>
      </div>
      <div className="text-xs text-ink-2 leading-relaxed">{body}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden md:block text-center text-ink-3 text-xl select-none">→</div>
  );
}
