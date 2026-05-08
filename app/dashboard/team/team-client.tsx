"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Loader2, Crown, Shield, Eye, Wrench, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, relativeTime } from "@/lib/utils";

interface Member {
  memberId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_META: Record<
  string,
  { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  owner: { label: "Propriétaire", color: "text-brand-magenta", bg: "bg-brand-magenta/10", Icon: Crown },
  admin: { label: "Administrateur", color: "text-brand-yellow", bg: "bg-brand-yellow/10", Icon: Shield },
  builder: { label: "Constructeur", color: "text-brand-blue-2", bg: "bg-brand-blue/10", Icon: Wrench },
  operator: { label: "Opérateur", color: "text-brand-green", bg: "bg-brand-green/10", Icon: UserCog },
  viewer: { label: "Lecteur", color: "text-ink-2", bg: "bg-bg-3", Icon: Eye },
};

export function TeamClient({
  currentUserRole,
  currentUserId,
  members,
}: {
  currentUserRole: string;
  currentUserId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canInvite = ["admin", "owner"].includes(currentUserRole);

  async function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email") ?? ""),
        role: String(fd.get("role") ?? "operator"),
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `HTTP ${r.status}`);
      setInviting(false);
      return;
    }
    setInviting(false);
    setShowInvite(false);
    router.refresh();
  }

  async function onChangeRole(memberId: string, role: string) {
    const r = await fetch(`/api/team/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!r.ok) alert("Modification du rôle échouée");
    router.refresh();
  }

  async function onRemove(memberId: string) {
    if (!confirm("Retirer ce membre de l'organisation ?")) return;
    await fetch(`/api/team/${memberId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Équipe</h1>
          <p className="text-ink-2 mt-1.5">
            Gérez les membres de votre organisation et leurs niveaux d'accès.
          </p>
        </div>
        {canInvite && (
          <Button variant="glow" onClick={() => setShowInvite(true)}>
            <UserPlus className="size-4" /> Inviter un membre
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <Card key={key}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <meta.Icon className={cn("size-3.5", meta.color)} />
                <span className="text-[11px] text-ink-2">{meta.label}</span>
              </div>
              <div className="text-xl font-medium tabular-nums">
                {members.filter((m) => m.role === key).length}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Membre</th>
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Email</th>
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Rôle</th>
              <th className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Ajouté</th>
              {canInvite && <th className="text-right text-[11px] uppercase tracking-wider font-mono text-ink-2 px-5 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const meta = ROLE_META[m.role] ?? ROLE_META.viewer;
              const Icon = meta.Icon;
              const isMe = m.userId === currentUserId;
              return (
                <tr key={m.memberId} className="border-b border-line last:border-0 hover:bg-bg-3/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-grad text-white text-xs font-semibold flex items-center justify-center shrink-0">
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {m.name}
                          {isMe && <span className="text-ink-3 ml-2 text-xs">(vous)</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-ink-2 font-mono">{m.email}</td>
                  <td className="px-5 py-3">
                    {canInvite && !isMe && m.role !== "owner" ? (
                      <select
                        value={m.role}
                        onChange={(e) => onChangeRole(m.memberId, e.target.value)}
                        className={cn(
                          "rounded-md border border-line bg-bg-2 px-2 py-1 text-xs font-medium font-mono",
                          meta.color,
                        )}
                      >
                        {Object.entries(ROLE_META)
                          .filter(([k]) => k !== "owner")
                          .map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded",
                          meta.color,
                          meta.bg,
                        )}
                      >
                        <Icon className="size-3" />
                        {meta.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-3">{relativeTime(m.createdAt)}</td>
                  {canInvite && (
                    <td className="px-5 py-3 text-right">
                      {!isMe && m.role !== "owner" && (
                        <button
                          onClick={() => onRemove(m.memberId)}
                          className="text-ink-3 hover:text-brand-red text-xs inline-flex items-center gap-1"
                        >
                          <UserMinus className="size-3" /> Retirer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {showInvite && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-bg/80 backdrop-blur-sm p-4"
          onClick={() => setShowInvite(false)}
        >
          <form
            onSubmit={onInvite}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md card p-6 space-y-4"
          >
            <h3 className="text-lg font-medium">Inviter un membre</h3>
            <p className="text-xs text-ink-2 -mt-2">
              L'utilisateur doit déjà avoir un compte Axion. L'invitation l'ajoute
              instantanément à votre organisation.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-2 font-mono">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="member@example.com"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-2 font-mono">
                Rôle
              </label>
              <select
                name="role"
                defaultValue="operator"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm font-mono"
              >
                {Object.entries(ROLE_META)
                  .filter(([k]) => k !== "owner")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
              </select>
            </div>
            {error && (
              <div className="rounded-md border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
                {error}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowInvite(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="glow" className="flex-1" disabled={inviting}>
                {inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Inviter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
