// V1_FINAL — read recent authorize() diag entries
export const runtime = "edge";

const SYSTEM_ORG = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  const [{ desc, eq }, { db, auditLogs }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
  ]);
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, SYSTEM_ORG))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);
  return Response.json(
    rows.map((r) => ({
      action: r.action,
      payload: r.payload,
      createdAt: r.createdAt,
    })),
  );
}
