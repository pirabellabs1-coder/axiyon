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

  return Response.json(
    { id: user.id, email: user.email, orgId: org.id, slug: org.slug },
    { status: 201 },
  );
}
