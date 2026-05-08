/**
 * /api/ping — fresh diagnostic route, zero imports beyond NextResponse.
 *
 * If THIS hangs while /api/health/db works, the issue is environment-specific
 * to certain bundles (or there's a Vercel platform glitch with stale routes).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, ts: Date.now(), pid: process.pid }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
