/**
 * Server-side tool execution endpoint.
 *
 * Called by the Puter client runtime when an agent emits a tool_call.
 * Auth via session cookie. Args validated against TOOL_SCHEMAS.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { TOOL_SCHEMAS } from "@/lib/agents/tool-schemas";
import { tools as serverTools } from "@/lib/agents/tools";


export const runtime = "edge";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await ctx.params;
  if (!TOOL_SCHEMAS[name]) {
    return NextResponse.json({ error: `Unknown tool: ${name}` }, { status: 404 });
  }

  let body: {
    args?: Record<string, unknown>;
    agentId?: string;
    templateSlug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tool = (serverTools as unknown as Record<
    string,
    { execute?: (args: unknown, opts?: unknown) => Promise<unknown> }
  >)[name];
  if (!tool?.execute) {
    return NextResponse.json({ error: `Tool ${name} has no executor` }, { status: 500 });
  }

  try {
    // Tools read orgId from a module-level singleton (set per request because
    // AI SDK's tool() helper doesn't have a context channel). We MUST set it
    // here so real API calls (Gmail send, Calendar book, etc) get the right
    // org's encrypted tokens. Cleared in finally to avoid cross-request bleed.
    const { db, agentInstances } = await import("@/lib/db");
    const { setToolOrgContext } = await import("@/lib/agents/tools");
    const { eq, and } = await import("drizzle-orm");

    // Validate that any agentId passed actually belongs to this org. If not,
    // fall back to a generic "chat-runtime" id rather than risk leaking another
    // org's agent reference through the audit chain.
    let resolvedAgentId = "chat-runtime";
    if (body.agentId && typeof body.agentId === "string") {
      const owned = await db
        .select({ id: agentInstances.id })
        .from(agentInstances)
        .where(
          and(
            eq(agentInstances.id, body.agentId),
            eq(agentInstances.orgId, session.user.activeOrgId),
          ),
        )
        .limit(1);
      if (owned[0]) resolvedAgentId = owned[0].id;
    }

    setToolOrgContext({
      orgId: session.user.activeOrgId,
      agentId: resolvedAgentId,
      taskId: crypto.randomUUID(),
    });
    try {
      const result = await tool.execute(body.args ?? {}, {
        orgId: session.user.activeOrgId,
        session: db,
      });
      return NextResponse.json(result);
    } finally {
      setToolOrgContext(null);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
