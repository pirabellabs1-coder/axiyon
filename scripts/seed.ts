/**
 * Idempotent seed script.
 *
 *   pnpm db:seed
 *
 * Creates a demo super-admin user, org, and 3 sample agents.
 * Safe to run multiple times — uses `email` unique constraint to skip duplicates.
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";

import * as schema from "../lib/db/schema";

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set POSTGRES_URL or DATABASE_URL.");
  process.exit(1);
}

const sql = neon(url);
const db = drizzle(sql, { schema });
const { users, orgs, orgMembers, agentInstances } = schema;

async function main() {
  const email = process.env.SEED_EMAIL ?? "founder@axiyon.local";
  const password = process.env.SEED_PASSWORD ?? "axiyon-demo-2026!";

  console.log(`Seeding with super-admin = ${email}`);

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: "Demo Founder",
        passwordHash: await bcrypt.hash(password, 12),
        isSuperuser: true,
      })
      .returning();
    user = created;
    console.log(`  · created user ${user.email}`);
  } else {
    console.log(`  · user already exists`);
  }

  let org = await db.query.orgs.findFirst({ where: eq(orgs.slug, "demo") });
  if (!org) {
    const [created] = await db
      .insert(orgs)
      .values({
        name: "Axiyon Demo",
        slug: "demo",
        tier: "growth",
        taskQuotaMonthly: 25_000,
        budgetEurMonthly: 5000,
      })
      .returning();
    org = created;
    console.log(`  · created org ${org.slug}`);
  }

  const member = await db.query.orgMembers.findFirst({
    where: (m, { and, eq }) => and(eq(m.userId, user!.id), eq(m.orgId, org!.id)),
  });
  if (!member) {
    await db.insert(orgMembers).values({ userId: user.id, orgId: org.id, role: "owner" });
    console.log(`  · created membership (owner)`);
  }

  const samples = [
    { templateSlug: "sdr-outbound", name: "Iris" },
    { templateSlug: "cfo-assistant", name: "Atlas" },
    { templateSlug: "support-l2", name: "Sage" },
  ];
  for (const s of samples) {
    const exists = await db.query.agentInstances.findFirst({
      where: (a, { and, eq }) => and(eq(a.orgId, org!.id), eq(a.templateSlug, s.templateSlug)),
    });
    if (exists) continue;
    await db.insert(agentInstances).values({
      orgId: org.id,
      templateSlug: s.templateSlug,
      name: s.name,
      enabledTools: [],
      budgetPerDayEur: 25,
    });
    console.log(`  · hired ${s.name} (${s.templateSlug})`);
  }

  console.log("\nDone. Login with:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
