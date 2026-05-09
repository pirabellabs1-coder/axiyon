"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTH_BASE = "/api/v1/auth";

async function loginWithCredentials(email: string, password: string, callbackUrl: string) {
  const csrfRes = await fetch(`${AUTH_BASE}/csrf`, { credentials: "include" });
  if (!csrfRes.ok) throw new Error("CSRF fetch failed");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    email,
    password,
    csrfToken,
    callbackUrl,
  });
  const r = await fetch(`${AUTH_BASE}/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
    redirect: "manual",
  });

  // Verify session was actually set.
  const sess = await fetch(`${AUTH_BASE}/session`, { credentials: "include" });
  const data = (await sess.json().catch(() => null)) as { user?: { id: string } } | null;
  if (!data?.user?.id) {
    return { ok: false, error: "Email ou mot de passe incorrect.", status: r.status };
  }
  return { ok: true };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-ink-2">Chargement…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").toLowerCase().trim();
    const password = String(fd.get("password") ?? "");

    try {
      const result = await loginWithCredentials(email, password, callbackUrl);
      if (!result.ok) {
        setError(result.error ?? "Échec de la connexion.");
        setLoading(false);
        return;
      }
      window.location.assign(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  return (
    <div className="card p-8">
      <h1 className="text-3xl font-medium tracking-tight mb-2">Connexion</h1>
      <p className="text-ink-2 text-sm mb-8">Bienvenue. On vous remet en selle.</p>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link href="/reset-password" className="text-xs text-brand-blue-2 hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" variant="glow" disabled={loading} className="mt-2">
          {loading ? "Connexion…" : "Se connecter →"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-brand-blue-2 hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
