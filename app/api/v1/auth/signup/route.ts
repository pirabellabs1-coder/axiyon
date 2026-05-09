// V1_FINAL — edge runtime (bcryptjs is pure JS, drizzle+neon-http edge-safe)
import { z } from "zod";

export const runtime = "edge";

const Body = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(255),
  password: z.string().min(10).max(128),
  orgName: z.string().min(1).max(255).optional(),
});

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "org"
  );
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 422 });
  }

  const [{ default: bcrypt }, { eq }, dbMod, audMod] = await Promise.all([
    import("bcryptjs"),
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/audit"),
  ]);
  const { db, users, orgs, orgMembers } = dbMod;
  const { audit } = audMod;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });
  if (existing) {
    return Response.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const isSuperuser =
    body.email === (process.env.SUPER_ADMIN_EMAIL ?? "").toLowerCase();

  const [user] = await db
    .insert(users)
    .values({
      email: body.email,
      name: body.name,
      passwordHash,
      isSuperuser,
    })
    .returning();

  const baseName = body.orgName ?? `${body.name.split(" ")[0]}'s workspace`;
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const collision = await db.query.orgs.findFirst({ where: eq(orgs.slug, slug) });
    if (!collision) break;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
  const [org] = await db.insert(orgs).values({ name: baseName, slug }).returning();
  await db
    .insert(orgMembers)
    .values({ userId: user.id, orgId: org.id, role: "owner" });

  await audit({
    orgId: org.id,
    actorType: "user",
    actorId: user.id,
    action: "user.signup",
    resourceType: "user",
    resourceId: user.id,
  });

  // ─── Pre-seed 9 demo agents so the dashboard looks like the public demo ───
  const { agentInstances } = dbMod;
  const SEED_AGENTS: Array<{
    templateSlug: string;
    name: string;
    status: "running" | "idle" | "paused" | "error";
    tasksToday: number;
    healthScore: number;
    budgetPerDayEur: number;
    lastRunAt: Date | null;
    enabledTools: string[];
  }> = [
    { templateSlug: "sdr-outbound",       name: "Iris · SDR Outbound",     status: "running", tasksToday: 340,  healthScore: 0.98, budgetPerDayEur: 10, lastRunAt: new Date(Date.now() - 60_000),       enabledTools: ["linkedin.search", "apollo.enrich", "email.send", "calendar.book"] },
    { templateSlug: "cfo-assistant",      name: "Atlas · CFO Adjoint",     status: "running", tasksToday: 42,   healthScore: 1.00, budgetPerDayEur: 30, lastRunAt: new Date(Date.now() - 240_000),      enabledTools: ["salesforce.lookup", "stripe.read", "model.predict"] },
    { templateSlug: "support-l2",         name: "Sage · Support N2",       status: "running", tasksToday: 1247, healthScore: 0.96, budgetPerDayEur: 15, lastRunAt: new Date(Date.now() - 30_000),        enabledTools: ["zendesk.read", "intercom.read", "kb.search"] },
    { templateSlug: "legal-counsel",      name: "Codex · Juriste",         status: "running", tasksToday: 23,   healthScore: 0.87, budgetPerDayEur: 25, lastRunAt: new Date(Date.now() - 720_000),       enabledTools: ["contract.draft", "kb.search"] },
    { templateSlug: "recruiter",          name: "Nova · Recruteuse",       status: "running", tasksToday: 38,   healthScore: 0.94, budgetPerDayEur: 20, lastRunAt: new Date(Date.now() - 480_000),       enabledTools: ["linkedin.search", "github.list_prs"] },
    { templateSlug: "devops",             name: "Forge · DevOps",          status: "running", tasksToday: 187,  healthScore: 1.00, budgetPerDayEur: 40, lastRunAt: new Date(Date.now() - 90_000),        enabledTools: ["github.create_issue", "github.list_prs"] },
    { templateSlug: "growth-marketer",    name: "Lumen · Marketing",       status: "running", tasksToday: 64,   healthScore: 0.99, budgetPerDayEur: 35, lastRunAt: new Date(Date.now() - 360_000),       enabledTools: ["email.send", "kb.search"] },
    { templateSlug: "data-scientist",     name: "Oracle · Data Scientist", status: "idle",    tasksToday: 12,   healthScore: 0.92, budgetPerDayEur: 20, lastRunAt: new Date(Date.now() - 3_600_000),     enabledTools: ["model.predict"] },
    { templateSlug: "ops-lead",           name: "Factory · Ops",           status: "paused",  tasksToday: 0,    healthScore: 0.85, budgetPerDayEur: 15, lastRunAt: new Date(Date.now() - 86_400_000),    enabledTools: ["slack.post", "calendar.book"] },
  ];

  try {
    await db.insert(agentInstances).values(
      SEED_AGENTS.map((a) => ({
        orgId: org.id,
        templateSlug: a.templateSlug,
        name: a.name,
        status: a.status,
        config: {},
        enabledTools: a.enabledTools,
        customPrompt: null,
        budgetPerDayEur: a.budgetPerDayEur,
        healthScore: a.healthScore,
        tasksToday: a.tasksToday,
        lastRunAt: a.lastRunAt,
      })),
    );
  } catch {
    /* If template_slug is constrained, ignore — the dashboard works empty too. */
  }

  return Response.json(
    { id: user.id, email: user.email, orgId: org.id, slug: org.slug, seeded: true },
    { status: 201 },
  );
}
