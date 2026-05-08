import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { auth } from "@/auth";
import { MarketingNav } from "@/components/nav";
import { TEMPLATES, categoryLabel } from "@/lib/agents/catalog";
import { Button } from "@/components/ui/button";
import { AgentIcon } from "@/components/agent-icon";
import { CatalogClient } from "./catalog-client";

export const metadata = { title: "Catalogue d'agents" };

export default async function AgentsCatalogPage() {
  const session = await auth();
  return (
    <>
      <MarketingNav session={session?.user} />
      <main className="pt-32 pb-24">
        <div className="container-x text-center max-w-3xl mb-12">
          <span className="inline-block text-[13px] font-medium tracking-widest uppercase text-brand-blue-2 mb-4">
            Catalogue · {TEMPLATES.length}+ agents
          </span>
          <h1 className="text-[clamp(40px,7vw,84px)] leading-[1] tracking-[-0.04em] font-medium mb-6">
            Recrutez l'employé IA{" "}
            <span className="font-serif italic">qu'il vous faut.</span>
          </h1>
          <p className="text-lg text-ink-2">
            Chaque agent vient avec un cerveau pré-entraîné, un toolkit branché,
            et une mémoire d'organisation. Démarrage en 60 secondes.
          </p>
        </div>

        <CatalogClient />

        <div className="text-center mt-16 container-x">
          <Button asChild variant="glow" size="lg">
            <Link href={session ? "/dashboard/agents/hire" : "/signup"}>
              {session ? "Recruter un agent" : "Créer mon compte"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </main>
    </>
  );
}
