import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";

import { agentInstances, db } from "@/lib/db";
import { WorkflowsClient } from "./workflows-client";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  // Bootstrap: trigger /api/workflows so presets get seeded if empty.
  // (Not called here — the client component fetches them on mount.)

  const agents = await db
    .select({
      id: agentInstances.id,
      templateSlug: agentInstances.templateSlug,
      enabledTools: agentInstances.enabledTools,
      customPrompt: agentInstances.customPrompt,
      name: agentInstances.name,
    })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  return (
    <WorkflowsClient
      hiredAgents={agents.map((a) => ({
        id: a.id,
        name: a.name,
        templateSlug: a.templateSlug,
        enabledTools: (a.enabledTools as string[] | null) ?? [],
        customPrompt: a.customPrompt,
      }))}
    />
  );
}
