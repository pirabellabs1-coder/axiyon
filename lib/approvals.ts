/**
 * Approval gate — agents call this when their tool wants to perform a
 * high-stakes action. Returns existing decision if one was already given,
 * otherwise creates a pending entry and returns 'pending'.
 */
import { and, desc, eq } from "drizzle-orm";
import { approvals, db } from "@/lib/db";
import { audit } from "@/lib/audit";

export interface RequestApprovalArgs {
  orgId: string;
  agentId: string;
  taskId?: string;
  actionType: string;
  summary: string;
  payload: Record<string, unknown>;
  estimatedImpactEur?: number;
}

export type ApprovalState =
  | { status: "approved"; id: string }
  | { status: "rejected"; id: string; note?: string }
  | { status: "pending"; id: string }
  | { status: "expired"; id: string };

/**
 * Check whether an action is auto-allowed based on policy thresholds, or whether
 * we must enqueue an approval. Default policy: anything > 1000 EUR estimated
 * impact, or any action of type call/sms/charge/dispatch needs approval.
 */
export function requiresApproval(
  actionType: string,
  estimatedImpactEur = 0,
): boolean {
  const HIGH_STAKES = new Set([
    "make_phone_call",
    "send_sms",
    "stripe_charge",
    "stripe_create_invoice",
    "github_dispatch_workflow",
  ]);
  if (HIGH_STAKES.has(actionType)) return true;
  if (estimatedImpactEur > 1000) return true;
  return false;
}

/**
 * Look up the latest decision for the same (org, agent, action_type, payload).
 * Used by tools to short-circuit if the user just approved an identical action.
 */
async function findExistingDecision(args: RequestApprovalArgs) {
  const recent = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.orgId, args.orgId),
        eq(approvals.agentId, args.agentId),
        eq(approvals.actionType, args.actionType),
      ),
    )
    .orderBy(desc(approvals.createdAt))
    .limit(5);
  return recent.find(
    (r) =>
      JSON.stringify(r.payload) === JSON.stringify(args.payload) &&
      ["approved", "rejected"].includes(r.status),
  );
}

export async function requestApproval(
  args: RequestApprovalArgs,
): Promise<ApprovalState> {
  const existing = await findExistingDecision(args);
  if (existing) {
    return {
      status: existing.status as "approved" | "rejected",
      id: existing.id,
    };
  }

  const [row] = await db
    .insert(approvals)
    .values({
      orgId: args.orgId,
      agentId: args.agentId,
      taskId: args.taskId ?? null,
      actionType: args.actionType,
      summary: args.summary,
      payload: args.payload,
      estimatedImpactEur: args.estimatedImpactEur ?? 0,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  await audit({
    orgId: args.orgId,
    actorType: "agent",
    actorId: args.agentId,
    action: "approval.requested",
    resourceType: "approval",
    resourceId: row.id,
    payload: { actionType: args.actionType, summary: args.summary.slice(0, 200) },
  }).catch(() => undefined);

  return { status: "pending", id: row.id };
}
