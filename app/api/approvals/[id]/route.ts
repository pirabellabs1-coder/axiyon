// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/** POST /api/approvals/[id] — { decision: "approved" | "rejected", note?: string } */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { approvals, db } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const [updated] = await db
    .update(approvals)
    .set({
      status: body.decision,
      respondedAt: new Date(),
      respondedBy: session.user.id,
      responseNote: body.note ?? null,
    })
    .where(
      and(
        eq(approvals.id, id),
        eq(approvals.orgId, session.user.activeOrgId),
        eq(approvals.status, "pending"),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Approval introuvable ou déjà tranchée" },
      { status: 404 },
    );
  }

  await audit({
    orgId: session.user.activeOrgId,
    actorType: "user",
    actorId: session.user.id,
    action: `approval.${body.decision}`,
    resourceType: "approval",
    resourceId: id,
    payload: { actionType: updated.actionType },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, status: updated.status });
}
