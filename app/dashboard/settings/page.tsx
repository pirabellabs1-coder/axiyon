import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db, orgs } from "@/lib/db";

import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  const org = await db.query.orgs.findFirst({
    where: eq(orgs.id, session.user.activeOrgId),
  });

  return (
    <SettingsClient
      user={{
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.activeOrgRole ?? "operator",
        isSuperuser: Boolean(session.user.isSuperuser),
      }}
      org={{
        name: org?.name ?? "—",
        slug: org?.slug ?? "—",
        tier: org?.tier ?? "solo",
        region: org?.region ?? "—",
        taskQuotaMonthly: org?.taskQuotaMonthly ?? 0,
        budgetEurMonthly: org?.budgetEurMonthly ?? 0,
      }}
    />
  );
}
