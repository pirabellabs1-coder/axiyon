// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/**
 * Daily cron — resets per-agent `tasks_today` counters at 00:05 UTC.
 *
 * Vercel auth: signed via the `Authorization: Bearer ${CRON_SECRET}` header
 * Vercel injects automatically when triggering the route via vercel.json.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { agentInstances, db } from "@/lib/db";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel cron sends a special header we should validate in production.
  const auth = req.headers.get("authorization");
  if (process.env.VERCEL && process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const r = await db
    .update(agentInstances)
    .set({ tasksToday: 0, updatedAt: new Date() })
    .where(sql`${agentInstances.tasksToday} > 0`)
    .returning({ id: agentInstances.id });

  return NextResponse.json({ ok: true, reset: r.length, at: new Date().toISOString() });
}
