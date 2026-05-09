"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-ink-2">Chargement…</div>}>
      <ResetView />
    </Suspense>
  );
}

function ResetView() {
  const search = useSearchParams();
  const token = search.get("token");
  return token ? <ConfirmForm token={token} /> : <RequestForm />;
}

// ─── Request reset ─────────────────────────────────────────────

function RequestForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ sent: boolean; resetUrl?: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        resetUrl?: string;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
        setLoading(false);
        return;
      }
      setDone({ sent: !!j.sent, resetUrl: j.resetUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8">
        <h1 className="text-2xl font-medium tracking-tight mb-3">
          {done.sent ? "Email envoyé" : "Lien généré"}
        </h1>
        <p className="text-ink-2 text-sm mb-6">
          {done.sent
            ? "Si l'email existe, un lien de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception (et les spams)."
            : "L'envoi d'email n'est pas encore configuré. Voici le lien que vous auriez reçu — il expire dans 1h :"}
        </p>
        {done.resetUrl && !done.sent && (
          <div className="mb-6 rounded-md border border-line bg-bg-2 p-3 text-xs font-mono break-all text-ink">
            <a href={done.resetUrl} className="text-brand-blue-2 hover:underline">
              {done.resetUrl}
            </a>
          </div>
        )}
        <Link href="/login" className="text-sm text-brand-blue-2 hover:underline">
          ← Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h1 className="text-3xl font-medium tracking-tight mb-2">Mot de passe oublié</h1>
      <p className="text-ink-2 text-sm mb-8">
        Entrez l'email associé à votre compte. Nous vous enverrons un lien pour choisir un nouveau mot
        de passe.
      </p>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" variant="glow" disabled={loading} className="mt-2">
          {loading ? "Envoi…" : "Envoyer le lien →"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        Vous vous souvenez ?{" "}
        <Link href="/login" className="text-brand-blue-2 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

// ─── Confirm reset ─────────────────────────────────────────────

function ConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 10) {
      setError("Le mot de passe doit faire au moins 10 caractères.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card p-8">
        <h1 className="text-3xl font-medium tracking-tight mb-2">Mot de passe mis à jour</h1>
        <p className="text-ink-2 text-sm mb-8">Vous pouvez maintenant vous connecter avec vos nouveaux identifiants.</p>
        <Link href="/login">
          <Button variant="glow" className="w-full">Se connecter →</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h1 className="text-3xl font-medium tracking-tight mb-2">Nouveau mot de passe</h1>
      <p className="text-ink-2 text-sm mb-8">Choisissez un mot de passe d'au moins 10 caractères.</p>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirmer</Label>
          <Input
            id="confirm"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" variant="glow" disabled={loading} className="mt-2">
          {loading ? "Mise à jour…" : "Réinitialiser →"}
        </Button>
      </form>
    </div>
  );
}
