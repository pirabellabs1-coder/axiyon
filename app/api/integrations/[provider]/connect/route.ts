// REBUNDLE_2026_05_09 — force lambda rebuild after maxDuration global config
/**
 * GET  /api/integrations/[provider]/connect
 *   → For OAuth providers : redirects to the authorize URL with signed state.
 *   → For api_key providers : returns 405 (UI handles via POST).
 *
 * POST /api/integrations/[provider]/connect
 *   → For api_key providers : accepts JSON {fields:{...}}, persists encrypted creds.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import {
  buildAuthorizeUrl,
  signState,
} from "@/lib/integrations/oauth";
import { getProvider } from "@/lib/integrations/providers";
import { persistApiKeyConnection } from "@/lib/integrations/store";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user.activeOrgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider: slug } = await ctx.params;
  const provider = getProvider(slug);
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (provider.flow.type !== "oauth2") {
    return NextResponse.json(
      { error: "Use POST for api_key providers" },
      { status: 405 },
    );
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to") ?? "/dashboard/integrations";

  try {
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
  if (!session?.user.activeOrgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider: slug } = await ctx.params;
  const provider = getProvider(slug);
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (provider.flow.type !== "api_key")
    return NextResponse.json({ error: "Provider requires OAuth flow" }, { status: 405 });

  const body = (await req.json().catch(() => ({}))) as { fields?: Record<string, string> };
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Missing fields" }, { status: 422 });
  }

  // Validate required fields exist
  for (const f of provider.flow.fields) {
    if (f.secret && !body.fields[f.name]) {
      return NextResponse.json({ error: `Champ requis manquant : ${f.label}` }, { status: 422 });
    }
  }

  try {
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
