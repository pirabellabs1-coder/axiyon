/**
 * /api/health — minimal node-runtime diagnostic.
 *
 * Reports only whether config is *present*, never a value: no secret is ever
 * returned. Public on purpose — it's the fastest way to answer "why doesn't
 * this integration connect?" without shell access to the Vercel project.
 */
import { PROVIDER_LIST } from "@/lib/integrations/providers";
import { getRedirectUri } from "@/lib/integrations/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  // An OAuth provider can only connect when BOTH halves of its credential
  // pair are set, under the exact env names lib/integrations/oauth.ts reads.
  const oauth = PROVIDER_LIST.filter((p) => p.flow.type === "oauth2").map((p) => {
    const prefix = p.slug.toUpperCase();
    const hasClientId = Boolean(process.env[`${prefix}_CLIENT_ID`]);
    const hasClientSecret = Boolean(process.env[`${prefix}_CLIENT_SECRET`]);
    return {
      provider: p.slug,
      ready: hasClientId && hasClientSecret,
      hasClientId,
      hasClientSecret,
      // Must match the redirect URI registered at the provider, byte for byte.
      redirectUri: getRedirectUri(p.slug),
      unlocksTools: p.unlocksTools.length,
    };
  });

  const apiKeyProviders = PROVIDER_LIST.filter((p) => p.flow.type === "api_key").map((p) => ({
    provider: p.slug,
    // API-key providers need no env config — the key is entered in the UI and
    // stored encrypted, so they are always "ready" to accept a connection.
    ready: true,
    unlocksTools: p.unlocksTools.length,
  }));

  // The single most common cause of `redirect_uri_mismatch`: when
  // NEXT_PUBLIC_APP_URL and AUTH_URL are both unset, getRedirectUri() falls
  // back to VERCEL_URL, which is unique per deployment and can therefore never
  // match a redirect URI registered at a provider.
  const appUrlPinned = Boolean(process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL);

  return new Response(
    JSON.stringify(
      {
        ok: true,
        v: 3,
        ts: Date.now(),
        node: process.version,
        region: process.env.VERCEL_REGION ?? "?",
        env: {
          hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
          hasAuthSecret: Boolean(process.env.AUTH_SECRET),
          hasEncryptionKey: Boolean(process.env.AXION_ENCRYPTION_KEY),
          hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
          hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
          hasMigrationSecret: Boolean(
            process.env.MIGRATION_SECRET ?? process.env.CRON_SECRET,
          ),
        },
        integrations: {
          appUrlPinned,
          appUrlWarning: appUrlPinned
            ? null
            : "NEXT_PUBLIC_APP_URL is unset — redirect URIs fall back to the " +
              "per-deployment VERCEL_URL and will never match what you " +
              "registered at any provider. Set it to your canonical origin.",
          oauthReady: oauth.filter((o) => o.ready).map((o) => o.provider),
          oauthMissing: oauth.filter((o) => !o.ready).map((o) => o.provider),
          oauth,
          apiKey: apiKeyProviders,
        },
      },
      null,
      2,
    ),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
