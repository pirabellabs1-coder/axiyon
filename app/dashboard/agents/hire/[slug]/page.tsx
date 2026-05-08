import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { categoryLabel, getTemplate } from "@/lib/agents/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { AgentIcon } from "@/components/agent-icon";
import { HireForm } from "./hire-form";

export default async function HireSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/agents/hire"
        className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" /> Catalogue
      </Link>

      <div className="flex items-start gap-4">
        <AgentIcon name={template.icon} size={26} wrapperClassName="size-14 rounded-xl" gradient />
        <div>
          <h1 className="text-2xl font-medium leading-tight">
            Recruter <span className="text-brand-blue-2">{template.name}</span>
          </h1>
          <p className="text-ink-2 text-sm mt-1">
            {template.role} · {categoryLabel(template.category)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3 text-sm text-ink-2 leading-relaxed">
          <p>{template.description}</p>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {template.skills.map((s) => (
              <span key={s} className="chip">{s}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <HireForm template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
