// Returns past conversation turns for a given agent (reconstructed from tasks).
import { auth } from "@/auth";

export const runtime = "edge";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return Response.json({ error: "Missing agentId" }, { status: 422 });
  }

  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "30"));

  const { eq, and, desc } = await import("drizzle-orm");
  const { db, tasks } = await import("@/lib/db");

  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.orgId, session.user.activeOrgId), eq(tasks.agentId, agentId)))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);

  // Reverse so oldest first, then expand each task into [user, assistant].
  const turns = rows.reverse().flatMap((t) => {
    const out = (t.outputPayload as Record<string, unknown>) ?? {};
    const text = typeof out.text === "string" ? out.text : "";
    const toolCalls = Array.isArray(t.toolCalls) ? t.toolCalls : [];
    return [
      {
        id: `u:${t.id}`,
        role: "user" as const,
        content: t.objective,
        createdAt: t.createdAt.toISOString(),
      },
      {
        id: `a:${t.id}`,
        role: "assistant" as const,
        content: text,
        toolCalls,
        createdAt: (t.finishedAt ?? t.createdAt).toISOString(),
      },
    ];
  });

  return Response.json({
    agentId,
    count: turns.length,
    turns,
  });
}
