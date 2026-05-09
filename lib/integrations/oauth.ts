/**
 * OAuth 2.0 helpers — code-flow with PKCE-light (state nonce).
 *
 * Edge-safe: uses Web Crypto + TextEncoder + btoa, no node:crypto, no Buffer.
 */
import { z } from "zod";

import { getProvider, type OauthFlow, type ProviderDef } from "./providers";

const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  orgId: string;
  userId: string;
  provider: string;
  returnTo?: string;
  iat: number;
}

// Base64url helpers using web-standard btoa/atob (edge + node 20+).
function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

function getStateSecret(): string {
  return (
    process.env.AUTH_SECRET ?? process.env.AXION_ENCRYPTION_KEY ?? "axion-dev-state-secret"
  );
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(payload: StatePayload): Promise<string> {
  const body = b64urlEncode(JSON.stringify(payload));
  const key = await importHmacKey(getStateSecret());
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  return `${body}.${b64urlEncodeBytes(sig)}`;
}

export async function verifyState(state: string): Promise<StatePayload> {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid state");
  const key = await importHmacKey(getStateSecret());
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  if (b64urlEncodeBytes(expected) !== sig) throw new Error("State signature mismatch");
  const payload = JSON.parse(b64urlDecode(body)) as StatePayload;
  if (Date.now() - payload.iat > STATE_TTL_MS) throw new Error("State expired");
  return payload;
}

export function getRedirectUri(provider: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/api/v1/integrations/${provider}/callback`;
}

export function buildAuthorizeUrl(provider: ProviderDef, state: string): string {
  if (provider.flow.type !== "oauth2") {
    throw new Error(`Provider ${provider.slug} is not an OAuth provider`);
  }
  const flow = provider.flow as OauthFlow;
  const clientId = process.env[`${provider.slug.toUpperCase()}_CLIENT_ID`];
  if (!clientId) {
    throw new Error(
      `Missing ${provider.slug.toUpperCase()}_CLIENT_ID env var. ` +
        `Configure your OAuth app at the provider, then add CLIENT_ID + CLIENT_SECRET to Vercel env.`,
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getRedirectUri(provider.slug),
    scope: flow.scopes.join(" "),
    state,
    ...(flow.authorizeExtraParams ?? {}),
  });
  return `${flow.authorizeUrl}?${params.toString()}`;
}

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  raw: Record<string, unknown>;
}

const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return "Basic " + btoa(`${clientId}:${clientSecret}`);
}

export async function exchangeCodeForToken(
  provider: ProviderDef,
  code: string,
): Promise<TokenResult> {
  if (provider.flow.type !== "oauth2") throw new Error("Not an OAuth provider");
  const flow = provider.flow as OauthFlow;

  const clientId = process.env[`${provider.slug.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.slug.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth credentials for ${provider.slug}`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(provider.slug),
    client_id: clientId,
    client_secret: clientSecret,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (provider.slug === "notion") {
    headers.Authorization = basicAuthHeader(clientId, clientSecret);
  }

  const res = await fetch(flow.tokenUrl, { method: "POST", headers, body: body.toString() });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || !("access_token" in json)) {
    throw new Error(
      `Token exchange failed for ${provider.slug}: ${res.status} ${JSON.stringify(json)}`,
    );
  }

  const parsed = TokenSchema.safeParse(json);
  if (!parsed.success) throw new Error(`Bad token response: ${parsed.error.message}`);

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: parsed.data.expires_in
      ? new Date(Date.now() + parsed.data.expires_in * 1000)
      : undefined,
    scopes: parsed.data.scope ? parsed.data.scope.split(" ") : flow.scopes,
    raw: json,
  };
}

export async function refreshOauthToken(
  provider: ProviderDef,
  refreshToken: string,
): Promise<TokenResult> {
  if (provider.flow.type !== "oauth2") throw new Error("Not an OAuth provider");
  const flow = provider.flow as OauthFlow;
  const clientId = process.env[`${provider.slug.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.slug.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error("Missing OAuth credentials");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (provider.slug === "notion") {
    headers.Authorization = basicAuthHeader(clientId, clientSecret);
  }

  const res = await fetch(flow.tokenUrl, { method: "POST", headers, body: body.toString() });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !("access_token" in json)) {
    throw new Error(`Refresh failed: ${res.status} ${JSON.stringify(json)}`);
  }

  return {
    accessToken: String(json.access_token),
    refreshToken: (json.refresh_token as string) ?? refreshToken,
    expiresAt: json.expires_in
      ? new Date(Date.now() + Number(json.expires_in) * 1000)
      : undefined,
    scopes: json.scope ? String(json.scope).split(" ") : [],
    raw: json,
  };
}

export async function fetchProviderProfile(
  provider: ProviderDef,
  accessToken: string,
): Promise<{ accountId?: string; accountEmail?: string; accountName?: string }> {
  if (provider.flow.type !== "oauth2") return {};
  const flow = provider.flow as OauthFlow;
  if (!flow.profileUrl) return {};

  const headers: Record<string, string> = { Accept: "application/json" };
  if (flow.profileAuth === "bearer") headers.Authorization = `Bearer ${accessToken}`;
  if (provider.slug === "notion") {
    headers["Notion-Version"] = "2022-06-28";
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (provider.slug === "github") headers["User-Agent"] = "axion";

  const res = await fetch(flow.profileUrl, { headers });
  if (!res.ok) return {};
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return flow.profileMap?.(json) ?? {};
}

export function getProviderOrThrow(slug: string): ProviderDef {
  const p = getProvider(slug);
  if (!p) throw new Error(`Unknown provider: ${slug}`);
  return p;
}
