import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <div
        className="text-[clamp(120px,30vw,260px)] font-serif italic leading-none gradient-text mb-4"
        aria-hidden="true"
      >
        404
      </div>
      <h1 className="text-4xl font-medium tracking-tight mb-4">
        Cette page <span className="font-serif italic">n'existe pas encore.</span>
      </h1>
      <p className="text-ink-2 max-w-md mb-8">
        Mais ne t'inquiète pas — un de nos agents est probablement en train de la construire en ce moment même.
      </p>
      <div className="flex gap-3">
        <Button asChild variant="glow">
          <Link href="/">Retour à l'accueil →</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
