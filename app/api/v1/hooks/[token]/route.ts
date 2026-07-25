/**
 * Inbound webhook trigger.
 *
 *   POST /api/v1/hooks/<trigger_token>
 *   Content-Type: application/json
 *   { "anything": "..." }        → becomes the workflow's inputs
 *
 * Unauthenticated by design: the token in the path IS the credential, so any
 * third party (a form, a CRM, a GitHub webhook) can fire a workflow without an
 * Axion session. Consequences that shape this handler:
 *
 *   - The token is a bearer secret sitting in a URL. It is generated with a
 *     CSPRNG, is revocable, and is the only thing gating execution.
 *   - Every failure returns a flat 404 with no detail. Distinguishing "unknown
 *     token" from "workflow exists but is a draft" would turn this endpoint
 *     into an oracle for probing valid tokens.
 *   - There is no rate limiting here. Anyone holding the token can trigger runs
 *     at will, so rotate it if it leaks.
 */
import { eq } from "drizzle-orm";

import { db, workflows } from "@/lib/db";
import { runWorkflowServerSide } from "@/lib/workflows/server-runner";
import type { WorkflowSpec } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Reject absurd payloads before touching the database. */
const MAX_BODY_BYTES = 128 * 1024;

function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // Cheap shape check first: a real token is a 48-char hex string, so anything
  // else is a probe and never reaches the database.
  if (!token || !/^[0-9a-f]{48}$/.test(token)) return notFound();

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let inputs: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      // A bare array or scalar is wrapped so `inputs` is always an object,
      // which is what the workflow spec and the runner expect.
      inputs =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { payload: parsed };
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const wf = await db.query.workflows.findFirst({
    where: eq(workflows.triggerToken, token),
  });

  // Same 404 for unknown token and unpublished workflow — see the note above.
  if (!wf || wf.status !== "published") return notFound();

  try {
    const outcome = await runWorkflowServerSide({
      orgId: wf.orgId,
      workflowId: wf.id,
      slug: wf.slug,
      spec: wf.spec as unknown as WorkflowSpec,
      inputs: { ...inputs, trigger: "webhook" },
      triggeredBy: "webhook",
    });

    // 200 even when the run failed: the webhook was accepted and a run record
    // exists. A 5xx would make senders like GitHub retry and duplicate the run.
    return Response.json({
      ok: outcome.status === "succeeded",
      runId: outcome.runId,
      status: outcome.status,
      steps: outcome.steps.map((s) => ({ id: s.id, status: s.status, error: s.error })),
      error: outcome.error,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Run failed" },
      { status: 500 },
    );
  }
}
