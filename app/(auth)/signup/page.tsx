"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-ink-2">Chargement…</div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? ""),
      name: String(fd.get("name") ?? ""),
      password: String(fd.get("password") ?? ""),
      orgName: String(fd.get("org") ?? "") || undefined,
    };

    const r = await fetch("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `HTTP ${r.status}`);
      setLoading(false);
      return;
    }

    // Auto-login
    const result = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    if (result?.error) {
      setError("Compte créé. Connexion impossible — réessayez via /login.");
      setLoading(false);
      return;
    }
    // Full reload so middleware picks up the freshly-set session cookie.
    window.location.assign(callbackUrl);
  }

  return (
    <div className="card p-8">
      <h1 className="text-3xl font-medium tracking-tight mb-2">Créer votre compte</h1>
      <p className="text-ink-2 text-sm mb-8">
        Compte + organisation créés en 5 secondes. Pas de CB.
      </p>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" name="name" required placeholder="Claire Laporte" autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="claire@helia.io"
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="org">Nom de l'organisation</Label>
          <Input id="org" name="org" placeholder="Helia (optionnel)" autoComplete="organization" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Mot de passe (min. 10 caractères)</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" variant="glow" disabled={loading} className="mt-2">
          {loading ? "Création…" : "Créer mon compte →"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-brand-blue-2 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
