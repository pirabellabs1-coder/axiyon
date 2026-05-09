// V1_FINAL — lazy-load heavy modules
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider: slug } = await ctx.params;
  const { getProvider } = await import("@/lib/integrations/providers");
  const provider = getProvider(slug);
  if (!provider)
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (provider.flow.type !== "oauth2") {
    return NextResponse.json(
      { error: "Use POST for api_key providers" },
      { status: 405 },
    );
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to") ?? "/dashboard/integrations";

  try {
    const { signState, buildAuthorizeUrl } = await import("@/lib/integrations/oauth");
    const state = signState({
      orgId: session.user.activeOrgId,
      userId: session.user.id,
      provider: slug,
      returnTo,
      iat: Date.now(),
    });
    const authorizeUrl = buildAuthorizeUrl(provider, state);
    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Authorize URL build failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user?.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider: slug } = await ctx.params;
  const { getProvider } = await import("@/lib/integrations/providers");
  const provider = getProvider(slug);
  if (!provider)
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (provider.flow.type !== "api_key")
    return NextResponse.json({ error: "Provider requires OAuth flow" }, { status: 405 });

  const body = (await req.json().catch(() => ({}))) as { fields?: Record<string, string> };
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Missing fields" }, { status: 422 });
  }

  for (const f of provider.flow.fields) {
    if (f.secret && !body.fields[f.name]) {
      return NextResponse.json(
        { error: `Champ requis manquant : ${f.label}` },
        { status: 422 },
      );
    }
  }

  try {
    const { persistApiKeyConnection } = await import("@/lib/integrations/store");
    const { audit } = await import("@/lib/audit");
    const integ = await persistApiKeyConnection({
      orgId: session.user.activeOrgId,
      provider,
      fields: body.fields,
    });
    await audit({
      orgId: session.user.activeOrgId,
      actorType: "user",
      actorId: session.user.id,
      action: "integration.connect",
      resourceType: "integration",
      resourceId: integ.id,
      payload: { provider: slug },
    }).catch(() => undefined);

    return NextResponse.json({
      id: integ.id,
      provider: integ.provider,
      accountName: integ.accountName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connection failed" },
      { status: 400 },
    );
  }
}
