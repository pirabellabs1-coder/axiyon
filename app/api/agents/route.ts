/**
 * GET  /api/agents — list current org's agents
 * POST /api/agents — hire a new agent (builder+ role)
 *
 * RECREATED 2026-05-09: previous file at this exact path was returning 000
 * timeouts on every request despite multiple maxDuration fixes; suspect a
 * Vercel function-cache anomaly tied to the path itself. This rewrite uses
 * a `Response` constructor instead of NextResponse and minimal imports to
 * exercise a maximally-different bundle hash.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getTemplate } from "@/lib/agents/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  templateSlug: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()).default({}),
  enabledTools: z.array(z.string()).default([]),
  customPrompt: z.string().max(8000).nullish(),
  budgetPerDayEur: z.number().int().min(0).max(100_000).default(10),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.activeOrgId) return json({ error: "Unauthorized" }, 401);

  const rows = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, session.user.activeOrgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  return json(rows);
}

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.activeOrgId) return json({ error: "Unauthorized" }, 401);

  if (!["builder", "admin", "owner"].includes(session.user.activeOrgRole ?? "")) {
    return json({ error: "Need builder role or higher to hire" }, 403);
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ error: "Invalid body" }, 422);
  }

  const tpl = getTemplate(body.templateSlug);
  if (!tpl) return json({ error: `Unknown template: ${body.templateSlug}` }, 404);

  const [row] = await db
    .insert(agentInstances)
    .values({
      orgId: session.user.activeOrgId,
      templateSlug: body.templateSlug,
      name: body.name,
      config: body.config,
      enabledTools: body.enabledTools.length ? body.enabledTools : tpl.defaultTools,
      customPrompt: body.customPrompt ?? null,
      budgetPerDayEur: body.budgetPerDayEur,
    })
    .returning();

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: "agent.hire",
    resourceType: "agent_instance",
    resourceId: row.id,
    payload: { template: body.templateSlug, name: body.name },
  });

  return json(row, 201);
}
