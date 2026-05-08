import { sql } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const rows = await db.select().from(users).orderBy(sql`${users.createdAt} DESC`).limit(500);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Utilisateurs</h1>
        <p className="text-ink-2 mt-1">{rows.length} comptes (500 derniers max).</p>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {["Email", "Nom", "Actif", "Super-admin", "Inscrit"].map((h) => (
                <th key={h} className="text-left text-[11px] uppercase tracking-wider font-mono text-ink-2 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-bg-3">
                <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.isActive ? "✓" : "—"}</td>
                <td className="px-4 py-3">
                  {u.isSuperuser ? <span className="text-brand-magenta">★</span> : "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs text-ink-3">
                  {relativeTime(u.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
