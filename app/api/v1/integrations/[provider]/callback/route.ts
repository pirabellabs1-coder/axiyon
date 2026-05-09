// V1_FINAL — edge runtime
export const runtime = "edge";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider: slug } = await ctx.params;
  const { getProvider } = await import("@/lib/integrations/providers");
  const provider = getProvider(slug);
  const base = new URL(req.url);
  if (!provider || provider.flow.type !== "oauth2") {
    return Response.redirect(
      new URL("/dashboard/integrations?error=unknown-provider", base).toString(),
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return Response.redirect(
      new URL(
        `/dashboard/integrations?error=${encodeURIComponent(errorParam)}&provider=${slug}`,
        base,
      ).toString(),
    );
  }
  if (!code || !state) {
    return Response.redirect(
      new URL(`/dashboard/integrations?error=missing-params&provider=${slug}`, base).toString(),
    );
  }

  const { verifyState } = await import("@/lib/integrations/oauth");
  let payload;
  try {
    payload = await verifyState(state);
  } catch {
    return Response.redirect(
      new URL(`/dashboard/integrations?error=invalid-state&provider=${slug}`, base).toString(),
    );
  }
  if (payload.provider !== slug) {
    return Response.redirect(
      new URL(`/dashboard/integrations?error=provider-mismatch`, base).toString(),
    );
  }

  try {
    const [{ persistOauthConnection }, { audit }] = await Promise.all([
      import("@/lib/integrations/store"),
      import("@/lib/audit"),
    ]);
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
    return Response.redirect(new URL(`${back}?connected=${slug}`, base).toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange-failed";
    return Response.redirect(
      new URL(
        `/dashboard/integrations?error=${encodeURIComponent(msg)}&provider=${slug}`,
        base,
      ).toString(),
    );
  }
}
