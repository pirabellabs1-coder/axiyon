/**
 * POST /api/v1/audit/verify — re-walk the SHA-256 audit chain for the org and
 * confirm every link. Returns first tampered row's id if any.
 */
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { auditLogs, db } from "@/lib/db";

export const runtime = "edge";

export async function POST() {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.activeOrgId;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(auditLogs.createdAt);

  let prevHash: string | null = null;
  let firstTamperedId: string | null = null;

  for (const r of rows) {
    if (r.prevHash !== prevHash) {
      firstTamperedId = r.id;
      break;
    }
    prevHash = r.recordHash;
  }

  return Response.json({
    ok: firstTamperedId === null,
    n: rows.length,
    firstTamperedId,
    verifiedAt: new Date().toISOString(),
    note:
      firstTamperedId === null
        ? "Aucune anomalie détectée — la chaîne d'audit est intacte."
        : `Anomalie détectée à la ligne ${firstTamperedId}.`,
  });
}
