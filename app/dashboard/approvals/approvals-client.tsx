"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgentIcon } from "@/components/agent-icon";
import { CATALOG } from "@/lib/agents/catalog";
import { cn, formatEur, relativeTime } from "@/lib/utils";

interface ApprovalItem {
  id: string;
  agentName: string | null;
  agentTemplate: string | null;
  actionType: string;
  summary: string;
  payload: Record<string, unknown>;
  estimatedImpactEur: number;
  status: string;
  createdAt: string;
  respondedAt: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  send_email: "Envoi d'email",
  make_phone_call: "Appel téléphonique",
  send_sms: "Envoi SMS",
  crm_create_deal: "Création de deal CRM",
  stripe_create_invoice: "Création de facture Stripe",
  stripe_charge: "Encaissement Stripe",
  github_dispatch_workflow: "Déploiement (GitHub Actions)",
};

const STATUS = {
  pending: { label: "En attente", color: "text-brand-yellow", bg: "bg-brand-yellow/10", border: "border-brand-yellow/30", Icon: Clock },
  approved: { label: "Approuvé", color: "text-brand-green", bg: "bg-brand-green/10", border: "border-brand-green/30", Icon: CheckCircle2 },
  rejected: { label: "Rejeté", color: "text-brand-red", bg: "bg-brand-red/10", border: "border-brand-red/30", Icon: XCircle },
  expired: { label: "Expiré", color: "text-ink-3", bg: "bg-bg-3", border: "border-line", Icon: Clock },
} as const;

export function ApprovalsClient({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = filter === "pending" ? items.filter((i) => i.status === "pending") : items;
  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    total: items.length,
  };

  async function respond(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    try {
      await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Approbations</h1>
          <p className="text-ink-2 mt-1.5">
            Actions à fort impact placées en file par les agents. Vous gardez le dernier mot.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="En attente" value={counts.pending} accent="text-brand-yellow" Icon={Clock} />
        <StatTile label="Approuvées" value={counts.approved} accent="text-brand-green" Icon={CheckCircle2} />
        <StatTile label="Rejetées" value={counts.rejected} accent="text-brand-red" Icon={XCircle} />
        <StatTile label="Total" value={counts.total} accent="text-ink-2" Icon={Shield} />
      </div>

      <div className="flex gap-1.5">
        <FilterPill active={filter === "pending"} onClick={() => setFilter("pending")} label={`En attente (${counts.pending})`} />
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <div className="size-12 rounded-xl bg-grad shadow-glow mx-auto flex items-center justify-center">
              <Bell className="size-6 text-white" strokeWidth={1.6} />
            </div>
            <p className="text-ink-2">
              {filter === "pending"
                ? "Aucune approbation en attente. Vos agents agissent en autonomie."
                : "Aucune approbation enregistrée pour cette organisation."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const tpl = item.agentTemplate ? CATALOG[item.agentTemplate] : null;
            const status = STATUS[item.status as keyof typeof STATUS] ?? STATUS.expired;
            const StatusIcon = status.Icon;
            return (
              <Card
                key={item.id}
                className={cn(
                  "transition-colors",
                  item.status === "pending" && "border-brand-yellow/40 bg-brand-yellow/[0.02]",
                )}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <AgentIcon name={tpl?.icon ?? "Bot"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          <span className="text-brand-blue-2">{item.agentName ?? "Agent"}</span>
                          {tpl && <span className="text-ink-2 text-sm"> · {tpl.role}</span>}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border",
                            status.color,
                            status.bg,
                            status.border,
                          )}
                        >
                          <StatusIcon className="size-3" />
                          {status.label}
                        </span>
                        {item.estimatedImpactEur > 0 && (
                          <span className="text-[10px] font-mono text-ink-3">
                            Impact estimé : <strong className="text-ink-2">{formatEur(item.estimatedImpactEur)}</strong>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-3 font-mono mt-1">
                        {ACTION_LABEL[item.actionType] ?? item.actionType} · {relativeTime(item.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-line bg-bg-3 p-3">
                    <p className="text-sm leading-relaxed">{item.summary}</p>
                    {Object.keys(item.payload).length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-ink-2 hover:text-ink font-mono">
                          Voir le payload
                        </summary>
                        <pre className="mt-2 text-[11px] text-ink-3 overflow-x-auto whitespace-pre-wrap font-mono">
                          {JSON.stringify(item.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={busy === item.id}
                        onClick={() => respond(item.id, "rejected")}
                      >
                        {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                        Rejeter
                      </Button>
                      <Button
                        variant="glow"
                        size="sm"
                        className="flex-1"
                        disabled={busy === item.id}
                        onClick={() => respond(item.id, "approved")}
                      >
                        {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Approuver
                      </Button>
                    </div>
                  )}

                  {item.status !== "pending" && item.respondedAt && (
                    <div className="text-[11px] text-ink-3 font-mono">
                      Décidé {relativeTime(item.respondedAt)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
  Icon,
}: {
  label: string;
  value: number;
  accent: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-xs text-ink-2">{label}</div>
          <Icon className={cn("size-4", accent)} />
        </div>
        <div className="text-2xl font-medium tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md border text-xs whitespace-nowrap transition-colors font-medium",
        active
          ? "bg-brand-blue text-white border-brand-blue"
          : "border-line bg-bg-2 text-ink-2 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
