import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { auditLogs, db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyChain } from "@/lib/audit";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(sql`${auditLogs.createdAt} DESC`)
    .limit(200);

  const verification = await verifyChain(orgId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Audit log</h1>
          <p className="text-ink-2 mt-1">
            Toutes les actions tracées dans une chaîne SHA-256 vérifiable.
          </p>
        </div>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <span
              className={
                "size-2 rounded-full " +
                (verification.ok
                  ? "bg-brand-green shadow-[0_0_10px_#34D399]"
                  : "bg-brand-red shadow-[0_0_10px_#F87171]")
              }
            />
            <div>
              <div className="text-xs text-ink-2">Chaîne</div>
              <div className="text-sm font-mono">
                {verification.ok ? "Verified" : "TAMPERED"} · {verification.n} records
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {["Quand", "Acteur", "Action", "Ressource", "Hash"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-4 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-bg-3">
                <td className="px-4 py-2.5 text-xs text-ink-3 w-32">{relativeTime(r.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <span className="chip text-[10px]">{r.actorType}</span>{" "}
                  <span className="font-mono text-xs text-ink-3">
                    {r.actorId.slice(0, 8)}…
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-brand-cyan">{r.action}</td>
                <td className="px-4 py-2.5 text-xs">
                  {r.resourceType}
                  {r.resourceId && (
                    <span className="text-ink-3"> · {r.resourceId.slice(0, 8)}…</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-ink-3">
                  {r.recordHash.slice(0, 16)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-12 text-center text-ink-2">Aucun événement encore.</div>
        )}
      </Card>
    </div>
  );
}
