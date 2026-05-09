/**
 * HMAC-signed password reset tokens (edge-safe).
 *
 * Format: b64url(JSON({userId, exp})) + "." + b64url(HMAC-SHA256)
 * TTL : 1 hour.
 */

const TTL_MS = 60 * 60 * 1000;

interface Payload {
  userId: string;
  exp: number;
}

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

function getSecret(): string {
  return (
    process.env.AUTH_SECRET ?? process.env.AXION_ENCRYPTION_KEY ?? "axion-dev-reset-secret"
  );
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signResetToken(userId: string): Promise<string> {
  const payload: Payload = { userId, exp: Date.now() + TTL_MS };
  const body = b64urlEncode(JSON.stringify(payload));
  const key = await getKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  return `${body}.${b64urlEncodeBytes(sig)}`;
}

export async function verifyResetToken(token: string): Promise<{ ok: boolean; userId?: string; reason?: string }> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;
  const key = await getKey();
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  if (b64urlEncodeBytes(expected) !== sig) return { ok: false, reason: "bad-signature" };
  let payload: Payload;
  try {
    payload = JSON.parse(b64urlDecode(body)) as Payload;
  } catch {
    return { ok: false, reason: "bad-payload" };
  }
  if (Date.now() > payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, userId: payload.userId };
}
