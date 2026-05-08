import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getTemplate } from "@/lib/agents/catalog";

const Body = z.object({
  templateSlug: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()).default({}),
  enabledTools: z.array(z.string()).default([]),
  customPrompt: z.string().max(8000).nullish(),
  budgetPerDayEur: z.number().int().min(0).max(100_000).default(10),
});

// GET /api/agents — list current org's agents
export async function GET() {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, session.user.activeOrgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  return NextResponse.json(rows);
}

// POST /api/agents — hire a new agent (builder+ role)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["builder", "admin", "owner"];
  if (!allowed.includes(session.user.activeOrgRole ?? "")) {
    return NextResponse.json(
      { error: "Need builder role or higher to hire" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const tpl = getTemplate(body.templateSlug);
  if (!tpl) {
    return NextResponse.json(
      { error: `Unknown template: ${body.templateSlug}` },
      { status: 404 },
    );
  }

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

  return NextResponse.json(row, { status: 201 });
}
