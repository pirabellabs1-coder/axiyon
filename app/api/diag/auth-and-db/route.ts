/**
 * Diagnostic: auth() THEN db query, just like /api/agents does.
 * Strips everything else (no audit, no schema queries, no zod, no template).
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const t0 = Date.now();
  const session = await auth();
  const tAuth = Date.now() - t0;
  const r = await db.execute("select 1 as one");
  const tDb = Date.now() - t0 - tAuth;
  return new Response(
    JSON.stringify({
      ok: true,
      tAuth,
      tDb,
      hasSession: !!session,
      result: r,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
