/**
 * Cron sweeper — the scheduled trigger for workflows.
 *
 *   POST/GET /api/cron/workflows      Authorization: Bearer $CRON_SECRET
 *
 * Vercel Cron invokes this on the cadence in vercel.json. The sweeper does NOT
 * assume it is called on the exact scheduled minute: each published workflow
 * carries its own cron expression, and `lastOccurrenceSince` asks whether an
 * occurrence fell between `last_run_at` and now. That makes firing independent
 * of the sweeper's cadence and recovers occurrences missed during a deploy.
 *
 * IMPORTANT: the sweeper's cadence bounds schedule resolution. If Vercel calls
 * this hourly, a workflow set to `*&#47;5 * * * *` still fires once an hour — a
 * finer schedule needs a finer cron entry in vercel.json (and a Vercel plan
 * that allows it).
 */
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db, workflows } from "@/lib/db";
import { lastOccurrenceSince, isValidCron } from "@/lib/workflows/cron";
import { runWorkflowServerSide } from "@/lib/workflows/server-runner";
import type { WorkflowSpec } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Cap per sweep so one invocation can't exceed maxDuration. */
const MAX_RUNS_PER_SWEEP = 5;

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

async function sweep(req: Request): Promise<Response> {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Accept
  // MIGRATION_SECRET too so the sweep can be triggered by hand while testing.
  const header = req.headers.get("authorization");
  const secrets = [process.env.CRON_SECRET, process.env.MIGRATION_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (!secrets.length) {
    return Response.json(
      { error: "No CRON_SECRET configured on this deployment" },
      { status: 500 },
    );
  }
  if (!header || !secrets.some((s) => header === `Bearer ${s}`)) return unauthorized();

  const now = new Date();

  const scheduled = await db.query.workflows.findMany({
    where: and(eq(workflows.status, "published"), isNotNull(workflows.scheduleCron)),
  });

  const due: Array<{ wf: (typeof scheduled)[number]; occurrence: Date }> = [];
  const invalid: Array<{ slug: string; cron: string }> = [];

  for (const wf of scheduled) {
    const expr = wf.scheduleCron!;
    if (!isValidCron(expr)) {
      // Surfaced in the response rather than thrown: one malformed expression
      // must not stop every other workflow in the org from being swept.
      invalid.push({ slug: wf.slug, cron: expr });
      continue;
    }
    const occurrence = lastOccurrenceSince(expr, wf.lastRunAt ?? null, now);
    if (occurrence) due.push({ wf, occurrence });
  }

  // Oldest owed occurrence first, so a backlog drains in schedule order.
  due.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());

  const executed: Array<{ slug: string; runId: string; status: string; error?: string }> = [];
  const skipped: string[] = [];

  for (const { wf, occurrence } of due) {
    if (executed.length >= MAX_RUNS_PER_SWEEP) {
      // Left for the next sweep: last_run_at is untouched, so the occurrence
      // is still owed and will not be lost.
      skipped.push(wf.slug);
      continue;
    }

    // Claim the occurrence BEFORE running it. `last_run_at` doubles as the lock:
    // the WHERE clause only matches while the row still holds the value this
    // sweep read, so if two sweeps overlap exactly one claims the occurrence and
    // the other's update matches no row. Claiming afterwards instead would let
    // both sweeps run the workflow before either recorded it.
    const claimed = await db
      .update(workflows)
      .set({ lastRunAt: occurrence, updatedAt: new Date() })
      .where(
        and(
          eq(workflows.id, wf.id),
          // Compare-and-set on the exact value this sweep read. For a
          // never-run workflow the predicate is `IS NULL`, which stops matching
          // the moment any sweep claims it.
          wf.lastRunAt ? eq(workflows.lastRunAt, wf.lastRunAt) : isNull(workflows.lastRunAt),
        ),
      )
      .returning({ id: workflows.id });

    if (!claimed.length) {
      skipped.push(wf.slug);
      continue;
    }

    try {
      const outcome = await runWorkflowServerSide({
        orgId: wf.orgId,
        workflowId: wf.id,
        slug: wf.slug,
        spec: wf.spec as unknown as WorkflowSpec,
        inputs: { triggeredAt: occurrence.toISOString(), trigger: "schedule" },
        triggeredBy: "schedule",
      });
      executed.push({
        slug: wf.slug,
        runId: outcome.runId,
        status: outcome.status,
        error: outcome.error,
      });
    } catch (e) {
      // The claim stands even on failure: retrying a half-executed workflow on
      // the next sweep could repeat side effects the first attempt already
      // committed (emails sent, invoices raised). The failed run row is the
      // record; re-running is an explicit human decision.
      executed.push({
        slug: wf.slug,
        runId: "",
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    ok: true,
    at: now.toISOString(),
    scheduledWorkflows: scheduled.length,
    due: due.length,
    executed,
    skipped,
    invalidCron: invalid,
    // Restated per response because a scheduled run failing with
    // "No LLM provider configured" is otherwise a confusing dead end.
    llmProviderConfigured: Boolean(
      process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY,
    ),
  });
}

// Vercel Cron issues GET; POST is kept for manual triggering with curl.
export async function GET(req: Request) {
  return sweep(req);
}
export async function POST(req: Request) {
  return sweep(req);
}
