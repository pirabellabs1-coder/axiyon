import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { TEMPLATES, categoryLabel } from "@/lib/agents/catalog";
import { WorkflowBuilder } from "./workflow-builder";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  if (!["builder", "admin", "owner"].includes(session.user.activeOrgRole ?? "")) {
    redirect("/dashboard/workflows");
  }

  const agents = TEMPLATES.map((t) => ({
    slug: t.slug,
    name: t.name,
    role: t.role,
    category: t.category,
    categoryLabel: categoryLabel(t.category),
    icon: t.icon,
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/dashboard/workflows"
        className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" /> Tous les workflows
      </Link>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Nouveau workflow</h1>
        <p className="text-ink-2 mt-1.5 text-sm">
          Chaîne plusieurs agents qui se passent la main automatiquement. Chaque étape reçoit
          en contexte les sorties des étapes précédentes.
        </p>
      </div>

      <WorkflowBuilder agents={agents} />
    </div>
  );
}
