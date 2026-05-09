// MIRRORED_TO_V1 — mirrored from app/api/workflows/route.ts
// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/**
 * GET  /api/workflows           — list current org's workflows (latest version per slug)
 * POST /api/workflows           — create or version a workflow
 *
 * On first access, if the org has no workflows, the GET endpoint seeds three
 * presets (deal-flow, monthly close, incident response) automatically.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db, workflows } from "@/lib/db";
import { audit } from "@/lib/audit";
import { WORKFLOW_PRESETS } from "@/lib/workflows/presets";
import type { WorkflowSpec } from "@/lib/workflows/types";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SpecSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  schedule_cron: z.string().optional(),
  steps: z.array(
    z.object({
      id: z.string().min(1),
      agent_slug: z.string().min(1),
      action: z.string().min(1).max(8000),
      depends_on: z.array(z.string()).optional(),
    }),
  ),
});

const Body = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  spec: SpecSchema,
});

async function ensureSeeded(orgId: string) {
  const existing = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(eq(workflows.orgId, orgId))
    .limit(1);
  if (existing.length > 0) return;

  for (const preset of WORKFLOW_PRESETS) {
    await db.insert(workflows).values({
      orgId,
      slug: preset.slug,
      name: preset.spec.name,
      description: preset.spec.description ?? null,
      version: 1,
      status: "published",
      spec: preset.spec as unknown as Record<string, unknown>,
      scheduleCron: preset.spec.schedule_cron ?? null,
    });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.activeOrgId;
  await ensureSeeded(orgId);

  // Latest version per slug
  const sub = db
    .select({
      slug: workflows.slug,
      maxVersion: sql<number>`max(${workflows.version})`.as("max_v"),
    })
    .from(workflows)
    .where(eq(workflows.orgId, orgId))
    .groupBy(workflows.slug)
    .as("latest");

  const rows = await db
    .select()
    .from(workflows)
    .innerJoin(
      sub,
      and(eq(workflows.slug, sub.slug), eq(workflows.version, sub.maxVersion)),
    )
    .where(eq(workflows.orgId, orgId))
    .orderBy(desc(workflows.createdAt));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.workflows.id,
      slug: r.workflows.slug,
      name: r.workflows.name,
      description: r.workflows.description,
      version: r.workflows.version,
      status: r.workflows.status,
      spec: r.workflows.spec as unknown as WorkflowSpec,
      scheduleCron: r.workflows.scheduleCron,
      createdAt: r.workflows.createdAt,
    })),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["builder", "admin", "owner"].includes(session.user.activeOrgRole ?? "")) {
    return NextResponse.json({ error: "Need builder role" }, { status: 403 });
  }
  const orgId = session.user.activeOrgId;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid body", detail: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }

  // New version if slug exists
  const last = await db
    .select({ version: workflows.version })
    .from(workflows)
    .where(and(eq(workflows.orgId, orgId), eq(workflows.slug, body.slug)))
    .orderBy(desc(workflows.version))
    .limit(1);
  const nextVersion = last[0] ? last[0].version + 1 : 1;

  const [row] = await db
    .insert(workflows)
    .values({
      orgId,
      slug: body.slug,
      name: body.spec.name,
      description: body.spec.description ?? null,
      version: nextVersion,
      status: "published",
      spec: body.spec as unknown as Record<string, unknown>,
      scheduleCron: body.spec.schedule_cron ?? null,
    })
    .returning();

  await audit({
    orgId,
    actorType: "user",
    actorId: session.user.id,
    action: "workflow.create",
    resourceType: "workflow",
    resourceId: row.id,
    payload: { slug: body.slug, version: nextVersion },
  });

  return NextResponse.json({ id: row.id, slug: row.slug, version: row.version }, { status: 201 });
}
