"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-ink-2">Chargement…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
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

    const result = await signIn("credentials", {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    window.location.assign(callbackUrl);
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
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
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
