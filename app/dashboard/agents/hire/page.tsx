import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TEMPLATES, categoryLabel } from "@/lib/agents/catalog";
import { HireCatalog } from "./hire-catalog";

export default function HirePage() {
  // Pass plain serialisable data to the client component.
  const templates = TEMPLATES.map((t) => ({
    slug: t.slug,
    name: t.name,
    role: t.role,
    category: t.category,
    categoryLabel: categoryLabel(t.category),
    icon: t.icon,
    description: t.description,
    skills: t.skills,
    defaultTools: t.defaultTools,
    priceEurMonthly: t.priceEurMonthly,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="size-3.5" /> Retour aux agents
        </Link>
        <h1 className="text-3xl font-medium tracking-tight mt-3">Recruter un agent</h1>
        <p className="text-ink-2 mt-1.5">
          Choisissez un profil dans le catalogue. Vous pourrez personnaliser ses outils,
          son budget et son prompt après.
        </p>
      </div>
      <HireCatalog templates={templates} />
    </div>
  );
}
