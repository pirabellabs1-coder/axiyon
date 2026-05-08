import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");

  const agents = await db
    .select({
      id: agentInstances.id,
      name: agentInstances.name,
      templateSlug: agentInstances.templateSlug,
      status: agentInstances.status,
    })
    .from(agentInstances)
    .where(eq(agentInstances.orgId, session.user.activeOrgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);

  return (
    <div className="h-[calc(100vh-128px)] flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Chat live</h1>
        <p className="text-ink-2 text-sm">
          Discutez en direct avec un de vos agents. L'agent peut appeler ses outils en temps réel.
        </p>
      </div>
      <ChatClient agents={agents} />
    </div>
  );
}
