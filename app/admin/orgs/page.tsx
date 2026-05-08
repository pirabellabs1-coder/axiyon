import { sql } from "drizzle-orm";
import { db, orgs, agentInstances, tasks, orgMembers } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatNumber, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage() {
  const rows = await db.execute<{
    id: string;
    name: string;
    slug: string;
    tier: string;
    region: string;
    members: string;
    agents: string;
    tasks_count: string;
    created_at: string;
  }>(sql`
    SELECT
      o.id, o.name, o.slug, o.tier::text AS tier, o.region,
      (SELECT COUNT(*) FROM ${orgMembers} m WHERE m.org_id = o.id)::text AS members,
      (SELECT COUNT(*) FROM ${agentInstances} a WHERE a.org_id = o.id)::text AS agents,
      (SELECT COUNT(*) FROM ${tasks} t WHERE t.org_id = o.id)::text AS tasks_count,
      o.created_at
    FROM ${orgs} o
    ORDER BY o.created_at DESC
  `);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Toutes les organisations</h1>
        <p className="text-ink-2 mt-1">{rows.rows.length} orgs sur la plate-forme.</p>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {["Org", "Slug", "Plan", "Région", "Membres", "Agents", "Tâches", "Créé"].map((h) => (
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
            {rows.rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-bg-3">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-3">{r.slug}</td>
                <td className="px-4 py-3 text-xs">{r.tier}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-3">{r.region}</td>
                <td className="px-4 py-3 text-right font-mono">{formatNumber(Number(r.members))}</td>
                <td className="px-4 py-3 text-right font-mono">{formatNumber(Number(r.agents))}</td>
                <td className="px-4 py-3 text-right font-mono">{formatNumber(Number(r.tasks_count))}</td>
                <td className="px-4 py-3 text-right text-xs text-ink-3">
                  {relativeTime(r.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
