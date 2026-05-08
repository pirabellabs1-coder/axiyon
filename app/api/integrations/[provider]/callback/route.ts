/**
 * GET /api/integrations/[provider]/callback
 *
 * OAuth redirect target. Exchanges the code for tokens, stores them encrypted,
 * then redirects the user back to the original `return_to`.
 */
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { verifyState } from "@/lib/integrations/oauth";
import { getProvider } from "@/lib/integrations/providers";
import { persistOauthConnection } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider: slug } = await ctx.params;
  const provider = getProvider(slug);
  if (!provider || provider.flow.type !== "oauth2") {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=unknown-provider", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations?error=${encodeURIComponent(errorParam)}&provider=${slug}`,
        req.url,
      ),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=missing-params&provider=${slug}`, req.url),
    );
  }

  let payload;
  try {
    payload = verifyState(state);
  } catch {
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=invalid-state&provider=${slug}`, req.url),
    );
  }
  if (payload.provider !== slug) {
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=provider-mismatch`, req.url),
    );
  }

  try {
    const integ = await persistOauthConnection({
      orgId: payload.orgId,
      provider,
      code,
    });

    await audit({
      orgId: payload.orgId,
      actorType: "user",
      actorId: payload.userId,
      action: "integration.connect",
      resourceType: "integration",
      resourceId: integ.id,
      payload: { provider: slug },
    }).catch(() => undefined);

    const back = payload.returnTo ?? "/dashboard/integrations";
    return NextResponse.redirect(new URL(`${back}?connected=${slug}`, req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange-failed";
    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations?error=${encodeURIComponent(msg)}&provider=${slug}`,
        req.url,
      ),
    );
  }
}
