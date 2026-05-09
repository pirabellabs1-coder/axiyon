// MIRRORED_TO_V1 — mirrored from app/api/tools/[name]/route.ts
// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
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

export const maxDuration = 30;

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

  let body: { args?: Record<string, unknown> };
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
    // Drizzle session passed for tools that need org-scoped queries (kb.search).
    const { db } = await import("@/lib/db");
    const result = await tool.execute(body.args ?? {}, {
      orgId: session.user.activeOrgId,
      session: db,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
