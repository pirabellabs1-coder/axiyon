// V1_FINAL — minimal top-level imports + lazy heavy deps
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  templateSlug: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()).default({}),
  enabledTools: z.array(z.string()).default([]),
  customPrompt: z.string().max(8000).nullish(),
  budgetPerDayEur: z.number().int().min(0).max(100_000).default(10),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ eq, sql }, dbMod] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
  ]);
  const { db, agentInstances } = dbMod;

  const rows = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, session.user.activeOrgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["builder", "admin", "owner"].includes(session.user.activeOrgRole ?? "")) {
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

  const [dbMod, catMod, audMod] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/agents/catalog"),
    import("@/lib/audit"),
  ]);
  const { db, agentInstances } = dbMod;
  const { getTemplate } = catMod;
  const { audit } = audMod;

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
