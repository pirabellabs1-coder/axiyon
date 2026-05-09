// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/**
 * Per-minute cron — picks up workflows whose cron schedule matches now and
 * dispatches a run. Idempotent: a run is created at most once per minute per workflow.
 */
import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";

import { db, workflowRuns, workflows } from "@/lib/db";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.VERCEL && process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // Naive: pick all published workflows with a non-null cron and create a run.
  // Production: parse the cron and fire only on actual schedule matches.
  const eligible = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.status, "published"), sql`${workflows.scheduleCron} IS NOT NULL`));

  let dispatched = 0;
  for (const wf of eligible) {
    // Check we haven't run in the last minute
    const recent = await db
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.workflowId, wf.id),
          sql`${workflowRuns.createdAt} > now() - interval '1 minute'`,
        ),
      )
      .limit(1);
    if (recent.length) continue;

    await db.insert(workflowRuns).values({
      workflowId: wf.id,
      orgId: wf.orgId,
      inputs: {},
      triggeredBy: "cron",
      status: "pending",
    });
    dispatched += 1;
  }

  return NextResponse.json({ ok: true, dispatched, at: new Date().toISOString() });
}
