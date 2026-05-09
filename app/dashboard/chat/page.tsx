import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { ChatView } from "./chat-view";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const agents = await db
    .select({
      id: agentInstances.id,
      name: agentInstances.name,
      templateSlug: agentInstances.templateSlug,
      status: agentInstances.status,
    })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, orgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  return (
    <ChatView
      userName={session.user.name ?? "Vous"}
      agents={agents.map((a) => ({
        id: a.id,
        name: a.name,
        templateSlug: a.templateSlug,
        status: a.status,
      }))}
    />
  );
}
