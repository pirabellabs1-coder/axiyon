/**
 * Trigger configuration for a workflow — schedule and inbound webhook.
 *
 *   GET    /api/v1/workflows/<slug>/trigger   read current triggers
 *   POST   /api/v1/workflows/<slug>/trigger   set schedule / issue webhook token
 *   DELETE /api/v1/workflows/<slug>/trigger   revoke the webhook token
 *
 * Applies to the workflow's latest version, matching the sibling `runs` route.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db, workflows } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isValidCron, describeCron } from "@/lib/workflows/cron";

export const runtime = "edge";

const Body = z.object({
  /** 5-field UTC cron, or null to remove the schedule. Omit to leave unchanged. */
  scheduleCron: z.string().trim().min(1).max(64).nullable().optional(),
  /** Issue a webhook token if none exists. */
  enableWebhook: z.boolean().optional(),
  /** Replace an existing token, invalidating the old URL. */
  rotateWebhook: z.boolean().optional(),
});

/** 24 CSPRNG bytes as 48 hex chars — matches the shape the hooks route accepts. */
function newTriggerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function webhookUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/api/v1/hooks/${token}`;
}

async function loadLatest(orgId: string, slug: string) {
  const rows = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.orgId, orgId), eq(workflows.slug, slug)))
    .orderBy(desc(workflows.version))
    .limit(1);
  return rows[0];
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const wf = await loadLatest(session.user.activeOrgId, slug);
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  return NextResponse.json({
    slug: wf.slug,
    status: wf.status,
    schedule: wf.scheduleCron
      ? {
          cron: wf.scheduleCron,
          human: describeCron(wf.scheduleCron),
          valid: isValidCron(wf.scheduleCron),
          lastRunAt: wf.lastRunAt,
        }
      : null,
    webhook: wf.triggerToken ? { url: webhookUrl(wf.triggerToken) } : null,
    // A schedule on a draft workflow is stored but never swept, which otherwise
    // looks like a broken scheduler.
    warning:
      wf.scheduleCron && wf.status !== "published"
        ? "Ce workflow a une planification mais n'est pas publié : le balayeur cron ne le déclenchera pas."
        : null,
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.activeOrgId;
  const { slug } = await ctx.params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }

  const wf = await loadLatest(orgId, slug);
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const updates: {
    scheduleCron?: string | null;
    triggerToken?: string;
    lastRunAt?: null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body.scheduleCron !== undefined) {
    if (body.scheduleCron === null) {
      updates.scheduleCron = null;
    } else {
      if (!isValidCron(body.scheduleCron)) {
        return NextResponse.json(
          {
            error: "Expression cron invalide",
            detail:
              "Format attendu : 5 champs UTC « minute heure jour-du-mois mois jour-de-semaine ». " +
              "Exemples : « 0 8 * * 1-5 » (8 h en semaine), « */15 * * * * » (tous les quarts d'heure).",
          },
          { status: 422 },
        );
      }
      updates.scheduleCron = body.scheduleCron;
      // Reset the watermark when the schedule changes, so the new schedule is
      // evaluated from now instead of inheriting the old one's catch-up window
      // and firing immediately for an occurrence it never owed.
      if (body.scheduleCron !== wf.scheduleCron) updates.lastRunAt = null;
    }
  }

  if (body.rotateWebhook || (body.enableWebhook && !wf.triggerToken)) {
    updates.triggerToken = newTriggerToken();
  }

  const [updated] = await db
    .update(workflows)
    .set(updates)
    .where(eq(workflows.id, wf.id))
    .returning();

  await audit({
    orgId,
    actorType: "user",
    actorId: session.user.id,
    action: "workflow.trigger.update",
    resourceType: "workflow",
    resourceId: wf.id,
    payload: {
      slug,
      scheduleCron: updated.scheduleCron,
      // Never log the token itself — an audit row is readable by the whole org.
      webhookIssued: Boolean(updates.triggerToken),
      webhookRotated: Boolean(body.rotateWebhook && wf.triggerToken),
    },
  }).catch(() => undefined);

  return NextResponse.json({
    slug: updated.slug,
    schedule: updated.scheduleCron
      ? { cron: updated.scheduleCron, human: describeCron(updated.scheduleCron) }
      : null,
    // Returned in full only here, right after issuing: this is the one moment
    // the caller can copy it.
    webhook: updated.triggerToken ? { url: webhookUrl(updated.triggerToken) } : null,
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user.activeOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.user.activeOrgId;
  const { slug } = await ctx.params;

  const wf = await loadLatest(orgId, slug);
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  await db
    .update(workflows)
    .set({ triggerToken: null, updatedAt: new Date() })
    .where(eq(workflows.id, wf.id));

  await audit({
    orgId,
    actorType: "user",
    actorId: session.user.id,
    action: "workflow.trigger.webhook.revoke",
    resourceType: "workflow",
    resourceId: wf.id,
    payload: { slug },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, revoked: true });
}
