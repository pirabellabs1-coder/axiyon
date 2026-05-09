import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Plus, Pause, Play, Settings } from "lucide-react";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTemplate } from "@/lib/agents/catalog";
import { AgentIcon } from "@/components/agent-icon";

export const dynamic = "force-dynamic";

// Per-agent gradient (matches the demo dashboard.html palette)
const AGENT_GRADIENTS: Record<string, string> = {
  "sdr-outbound":    "linear-gradient(135deg,#5B6CFF,#22D3EE)",   // Iris
  "cfo-assistant":   "linear-gradient(135deg,#FF3D8E,#5B6CFF)",   // Atlas
  "support-l2":      "linear-gradient(135deg,#22D3EE,#34D399)",   // Sage
  "legal-counsel":   "linear-gradient(135deg,#E8B86D,#FF3D8E)",   // Codex
  "recruiter":       "linear-gradient(135deg,#FF3D8E,#E8B86D)",   // Nova
  "devops":          "linear-gradient(135deg,#5A5A6E,#7C8AFF)",   // Forge
  "growth-marketer": "linear-gradient(135deg,#34D399,#22D3EE)",   // Lumen
  "data-scientist":  "linear-gradient(135deg,#7C8AFF,#FF3D8E)",   // Oracle
  "ops-lead":        "linear-gradient(135deg,#5A5A6E,#FF3D8E)",   // Factory
};

function gradientFor(slug: string): string {
  return AGENT_GRADIENTS[slug] ?? "linear-gradient(135deg,#5B6CFF,#22D3EE)";
}

function healthLabel(score: number): string {
  if (score >= 0.99) return "parfaite";
  if (score >= 0.95) return "excellente";
  if (score >= 0.90) return "bonne";
  if (score >= 0.80) return "à surveiller";
  return "dégradée";
}

function healthColor(score: number): string {
  if (score >= 0.95) return "text-brand-green";
  if (score >= 0.85) return "text-brand-yellow";
  return "text-brand-red";
}

function statusDot(status: string): string {
  if (status === "running") return "bg-brand-green shadow-[0_0_8px_rgba(52,211,153,.6)]";
  if (status === "idle") return "bg-brand-blue-2 shadow-[0_0_8px_rgba(124,138,255,.6)]";
  if (status === "paused") return "bg-ink-3";
  if (status === "error") return "bg-brand-red shadow-[0_0_8px_rgba(248,113,113,.6)]";
  return "bg-ink-3";
}

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const agents = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId))
    .orderBy(sql`${agentInstances.tasksToday} DESC`);

  const total = agents.length;
  const running = agents.filter((a) => a.status === "running").length;
  const avgHealth =
    total > 0
      ? agents.reduce((sum, a) => sum + (Number(a.healthScore) || 0), 0) / total
      : 1;
  const uptimePct = (avgHealth * 100).toFixed(2).replace(".", ",");

  if (total === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-medium tracking-tight">Vos agents</h1>
          <Button asChild variant="glow">
            <Link href="/dashboard/agents/hire">
              <Plus className="size-4" /> Recruter
            </Link>
          </Button>
        </div>
        <Card className="p-12 text-center space-y-4">
          <AgentIcon
            name="Bot"
            size={28}
            wrapperClassName="size-14 rounded-xl mx-auto"
            gradient
          />
          <p className="text-ink-2">Aucun agent recruté pour l'instant.</p>
          <Button asChild variant="glow">
            <Link href="/dashboard/agents/hire">Recruter mon premier agent</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            {total} agent{total > 1 ? "s" : ""} en production
          </h1>
          <p className="text-ink-2 mt-1 text-sm">
            {running === total ? "Tous opérationnels" : `${running}/${total} opérationnels`} ·
            uptime moyen {uptimePct}%
          </p>
        </div>
        <Button asChild variant="glow">
          <Link href="/dashboard/agents/hire">
            <Plus className="size-4" /> Recruter
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-bg-3/40">
                <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3 w-10" />
                <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Agent</th>
                <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Tâches (24h)</th>
                <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Santé</th>
                <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Coût (mois)</th>
                <th className="text-right text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3 pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const tpl = getTemplate(a.templateSlug);
                const health = Number(a.healthScore ?? 1);
                const healthPct = Math.round(health * 100);
                const monthlyCost = Math.round((a.budgetPerDayEur ?? 0) * 30 * 0.7);
                const taskCap = Math.max(50, Math.ceil(a.tasksToday * 1.4));
                return (
                  <tr
                    key={a.id}
                    className="border-b border-line last:border-0 hover:bg-bg-3/40 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className={`inline-block size-2 rounded-full ${statusDot(a.status)}`} />
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/agents/${a.id}`}
                        className="flex items-center gap-3 hover:opacity-90"
                      >
                        <span
                          className="inline-flex items-center justify-center shrink-0 size-9 rounded-lg text-white shadow-[0_0_18px_rgba(91,108,255,.25)]"
                          style={{ background: gradientFor(a.templateSlug) }}
                        >
                          <AgentIcon name={tpl?.icon ?? "Bot"} framed={false} size={16} className="text-white" />
                        </span>
                        <span className="font-medium">{a.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm tabular-nums text-ink">
                      {a.tasksToday.toLocaleString("fr-FR")} / {taskCap.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium ${healthColor(health)}`}>
                        {healthPct}%
                      </span>
                      <span className="text-ink-3 mx-2">•</span>
                      <span className="text-sm text-ink-2">{healthLabel(health)}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm tabular-nums text-ink">
                      {monthlyCost.toLocaleString("fr-FR")} €
                    </td>
                    <td className="px-5 py-4 pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          aria-label={a.status === "paused" ? "Reprendre" : "Mettre en pause"}
                          className="size-8 rounded-md hover:bg-bg-3 flex items-center justify-center text-ink-2 hover:text-ink transition-colors"
                          type="button"
                          disabled
                        >
                          {a.status === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
                        </button>
                        <Link
                          href={`/dashboard/agents/${a.id}`}
                          aria-label="Paramètres"
                          className="size-8 rounded-md hover:bg-bg-3 flex items-center justify-center text-ink-2 hover:text-ink transition-colors"
                        >
                          <Settings className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
