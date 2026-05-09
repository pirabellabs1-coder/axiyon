// Export the org's memory entries as a JSON file (no embeddings, plain text).
import { auth } from "@/auth";

export const runtime = "edge";

export async function GET() {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { eq, desc } = await import("drizzle-orm");
  const { db, memoryEntries } = await import("@/lib/db");

  const rows = await db
    .select({
      id: memoryEntries.id,
      kind: memoryEntries.kind,
      content: memoryEntries.content,
      summary: memoryEntries.summary,
      importance: memoryEntries.importance,
      source: memoryEntries.source,
      metadata: memoryEntries.metadata,
      createdAt: memoryEntries.createdAt,
    })
    .from(memoryEntries)
    .where(eq(memoryEntries.orgId, session.user.activeOrgId))
    .orderBy(desc(memoryEntries.createdAt));

  const stamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      orgId: session.user.activeOrgId,
      total: rows.length,
      entries: rows,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="axion-memory-${stamp}.json"`,
    },
  });
}
