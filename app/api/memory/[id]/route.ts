import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, memoryEntries } from "@/lib/db";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await db
    .delete(memoryEntries)
    .where(
      and(eq(memoryEntries.id, id), eq(memoryEntries.orgId, session.user.activeOrgId)),
    );
  return NextResponse.json({ ok: true });
}
