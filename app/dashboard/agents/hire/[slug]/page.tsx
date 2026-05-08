import { notFound } from "next/navigation";
import Link from "next/link";

import { getTemplate } from "@/lib/agents/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Link href="/dashboard/agents/hire" className="text-sm text-ink-2 hover:text-ink">
        ← Catalogue
      </Link>

      <div className="flex items-start gap-4">
        <div className="size-14 rounded-xl bg-bg-3 border border-line flex items-center justify-center text-2xl">
          {template.icon}
        </div>
        <div>
          <h1 className="text-2xl font-medium">
            Recruter <span className="text-brand-blue-2">{template.name}</span>
          </h1>
          <p className="text-ink-2 text-sm mt-1">{template.role}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3 text-sm text-ink-2 leading-relaxed">
          <p>{template.description}</p>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {template.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
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
