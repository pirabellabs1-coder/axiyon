/**
 * Diagnostic: CALLS auth() to read the JWT cookie. No DB.
 * If /diag/auth-import works but this hangs, it's auth()-the-function that hangs.
 */
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const t0 = Date.now();
  const session = await auth();
  return new Response(
    JSON.stringify({
      ok: true,
      took_ms: Date.now() - t0,
      hasSession: !!session,
      userId: session?.user?.id ?? null,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
