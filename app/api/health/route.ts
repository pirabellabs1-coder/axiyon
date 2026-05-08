/**
 * /api/health — minimal node-runtime diagnostic.
 *
 * Force a content change so Vercel rebundles this route fresh. Previous bundle
 * for this exact path was hanging at request time despite the source being
 * trivial — suspect a stale lambda artifact carried over across deploys.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      v: 2,
      ts: Date.now(),
      node: process.version,
      region: process.env.VERCEL_REGION ?? "?",
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasAuthSecret: !!process.env.AUTH_SECRET,
        hasEncryptionKey: !!process.env.AXION_ENCRYPTION_KEY,
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
