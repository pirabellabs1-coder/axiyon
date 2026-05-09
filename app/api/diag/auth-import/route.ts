/**
 * Diagnostic: just IMPORTS @/auth (top-level), never calls it.
 * If this hangs at request time, the hang is in NextAuth() module init —
 * something inside auth.ts construction is doing async work at module load
 * that blocks the lambda from starting.
 */
import { auth as _authUnused } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Reference to keep the import from being tree-shaken.
const _kept = typeof _authUnused;

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, importedAuth: _kept, ts: Date.now() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
