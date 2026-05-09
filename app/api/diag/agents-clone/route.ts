/**
 * Diagnostic: clone of /api/agents with identical imports.
 * If THIS works and /api/agents hangs, the difference is the lambda/bundle, not source.
 */
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { agentInstances, db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getTemplate } from "@/lib/agents/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const _kept = { eq, sql, z, audit, getTemplate, agentInstances };

export async function GET() {
  const t0 = Date.now();
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return NextResponse.json(
      { error: "Unauthorized", took_ms: Date.now() - t0, _has: Object.keys(_kept) },
      { status: 401 },
    );
  }
  const rows = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.orgId, session.user.activeOrgId))
    .orderBy(sql`${agentInstances.createdAt} DESC`);
  return NextResponse.json({ rows, took_ms: Date.now() - t0 });
}
