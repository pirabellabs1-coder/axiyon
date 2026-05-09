// V1_FINAL 1778289461 — production endpoint
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ingestMemory } from "@/lib/memory";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  content: z.string().min(1),
  kind: z.enum(["semantic", "episodic", "procedural", "client", "task"]).default("semantic"),
  importance: z.number().min(0).max(1).default(0.5),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const r = await ingestMemory({
    orgId: session.user.activeOrgId,
    content: body.content,
    kind: body.kind,
    importance: body.importance,
    source: "ui",
  });
  return NextResponse.json({ id: r.id });
}
