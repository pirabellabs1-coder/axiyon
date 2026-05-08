import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, memoryEntries } from "@/lib/db";
import { MemoryClient } from "./memory-client";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const entries = await db
    .select()
    .from(memoryEntries)
    .where(eq(memoryEntries.orgId, orgId))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(200);

  return (
    <MemoryClient
      entries={entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        content: e.content,
        summary: e.summary ?? null,
        importance: e.importance ?? 0.5,
        source: e.source ?? null,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
