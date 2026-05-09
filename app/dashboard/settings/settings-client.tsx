"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Minus, Loader2, Check, KeyRound, User as UserIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SettingsClientProps {
  user: {
    name: string;
    email: string;
    role: string;
    isSuperuser: boolean;
  };
  org: {
    name: string;
    slug: string;
    tier: string;
    region: string;
    taskQuotaMonthly: number;
    budgetEurMonthly: number;
  };
}

export function SettingsClient({ user, org }: SettingsClientProps) {
  const router = useRouter();

  // Profile state
  const [name, setName] = useState(user.name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    if (!name.trim()) {
      setProfileMsg({ kind: "err", text: "Le nom ne peut pas être vide" });
      return;
    }
    setSavingProfile(true);
    try {
      const r = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; noChange?: boolean };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setProfileMsg({
        kind: "ok",
        text: j.noChange ? "Aucun changement détecté" : "Profil mis à jour. Reconnectez-vous pour voir le nouveau nom partout.",
      });
      router.refresh();
    } catch (e) {
      setProfileMsg({ kind: "err", text: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword.length < 10) {
      setPwdMsg({ kind: "err", text: "Au moins 10 caractères" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ kind: "err", text: "Les mots de passe ne correspondent pas" });
      return;
    }
    setSavingPwd(true);
    try {
      const r = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setPwdMsg({ kind: "ok", text: "Mot de passe changé." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPwdMsg({ kind: "err", text: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Paramètres</h1>
        <p className="text-ink-2 mt-1">Compte, organisation, moteur d&apos;IA.</p>
      </div>

      {/* Profile editor */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserIcon className="size-4 text-ink-2" />
            <h2 className="font-medium">Profil</h2>
          </div>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nom">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-ink-3 cursor-not-allowed"
                />
              </Field>
              <Field label="Rôle (org)">
                <input
                  type="text"
                  value={user.role}
                  disabled
                  className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-ink-3 font-mono cursor-not-allowed"
                />
              </Field>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-3 font-mono mb-1.5">
                  Super-admin
                </div>
                <div className="rounded-md border border-line bg-bg-3 px-3 py-2 text-sm flex items-center gap-1.5">
                  {user.isSuperuser ? (
                    <>
                      <Crown className="size-4 text-brand-magenta" />
                      <span>Oui</span>
                    </>
                  ) : (
                    <>
                      <Minus className="size-4 text-ink-3" />
                      <span className="text-ink-3">Non</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {profileMsg && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  profileMsg.kind === "ok"
                    ? "border-brand-green/30 bg-brand-green/5 text-brand-green"
                    : "border-brand-red/30 bg-brand-red/10 text-brand-red"
                }`}
              >
                {profileMsg.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={savingProfile || !name.trim() || name === user.name}>
                {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-ink-2" />
            <h2 className="font-medium">Mot de passe</h2>
          </div>
          <form onSubmit={savePassword} className="space-y-3">
            <Field label="Mot de passe actuel">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nouveau (≥ 10 caractères)">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                />
              </Field>
              <Field label="Confirmer">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-md border border-line bg-bg-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                />
              </Field>
            </div>
            {pwdMsg && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  pwdMsg.kind === "ok"
                    ? "border-brand-green/30 bg-brand-green/5 text-brand-green"
                    : "border-brand-red/30 bg-brand-red/10 text-brand-red"
                }`}
              >
                {pwdMsg.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={savingPwd || !currentPassword || !newPassword || !confirmPassword}
              >
                {savingPwd ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Changer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Organisation */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-medium">Organisation</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV label="Nom" value={org.name} />
            <KV label="Slug" value={org.slug} />
            <KV label="Plan" value={org.tier} />
            <KV label="Région" value={org.region} />
            <KV label="Tâches/mois" value={org.taskQuotaMonthly.toLocaleString("fr-FR")} />
            <KV label="Budget/mois" value={`${org.budgetEurMonthly} €`} />
          </div>
        </CardContent>
      </Card>

      {/* AI engine status — Puter (no API keys needed in test mode) */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-cyan" />
            <h2 className="font-medium">Moteur IA</h2>
          </div>
          <div className="rounded-md border border-brand-cyan/30 bg-brand-cyan/5 p-3 text-xs text-ink-2">
            <div className="font-medium text-brand-cyan mb-1">Puter.js · client-side</div>
            <p>
              Les agents tournent sur Claude Sonnet 4.5 / Opus 4 / GPT-4o via Puter.js
              (gratuit, sans clé API à gérer côté plateforme). L&apos;authentification
              s&apos;appuie sur la session navigateur de l&apos;utilisateur final, donc
              aucun coût n&apos;est imputé à l&apos;organisation.
            </p>
            <p className="mt-2 text-ink-3">
              Pour passer en production avec un quota dédié et un suivi de coût propriétaire,
              ajoutez <span className="font-mono">ANTHROPIC_API_KEY</span> ou{" "}
              <span className="font-mono">OPENAI_API_KEY</span> côté serveur — mais ce n&apos;est
              pas requis pendant la phase de test.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-ink-3 font-mono mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 font-mono">{label}</div>
      <div className="text-ink mt-0.5">{value}</div>
    </div>
  );
}
