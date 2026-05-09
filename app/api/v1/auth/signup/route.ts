// V1_FINAL 1778289461 — production endpoint
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db, users, orgs, orgMembers } from "@/lib/db";
import { audit } from "@/lib/audit";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(255),
  password: z.string().min(10).max(128),
  orgName: z.string().min(1).max(255).optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "org";
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const isSuperuser =
    body.email === (process.env.SUPER_ADMIN_EMAIL ?? "").toLowerCase();

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: body.email,
      name: body.name,
      passwordHash,
      isSuperuser,
    })
    .returning();

  // Create org with unique slug
  const baseName = body.orgName ?? `${body.name.split(" ")[0]}'s workspace`;
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
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

  return NextResponse.json(
    { id: user.id, email: user.email, orgId: org.id, slug: org.slug },
    { status: 201 },
  );
}
