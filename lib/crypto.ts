/**
 * AES-256-GCM encryption for sensitive data (OAuth tokens at rest).
 *
 * Edge-safe: uses Web Crypto + TextEncoder + btoa, no node:crypto.
 *
 * Key is derived from `AXION_ENCRYPTION_KEY` env var (32 bytes / 256 bits) —
 * generate with: `openssl rand -hex 32`.
 *
 * Format: iv(12) || authTag(16) || ciphertext  → base64url
 *
 * NOTE: All functions are async because Web Crypto's AES-GCM API is async.
 */
const IV_LEN = 12;
const TAG_LEN = 16;

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const raw = process.env.AXION_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "Missing AXION_ENCRYPTION_KEY (or AUTH_SECRET fallback). Generate with `openssl rand -hex 32` and set in env.",
    );
  }
  let keyBytes: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    keyBytes = hexToBytes(raw);
  } else {
    // Hash down to 32 bytes deterministically.
    const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    keyBytes = new Uint8Array(hashed);
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await getKey();
  const ctWithTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  // Web Crypto AES-GCM appends the 16-byte auth tag at the END of ciphertext.
  // Our format expects: iv(12) || tag(16) || ct. So we re-arrange.
  const ct = ctWithTag.slice(0, ctWithTag.length - TAG_LEN);
  const tag = ctWithTag.slice(ctWithTag.length - TAG_LEN);
  const out = new Uint8Array(IV_LEN + TAG_LEN + ct.length);
  out.set(iv, 0);
  out.set(tag, IV_LEN);
  out.set(ct, IV_LEN + TAG_LEN);
  return bytesToB64url(out);
}

export async function decrypt(token: string): Promise<string> {
  const buf = b64urlToBytes(token);
  if (buf.length < IV_LEN + TAG_LEN) throw new Error("Invalid ciphertext");
  const iv = buf.slice(0, IV_LEN);
  const tag = buf.slice(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.slice(IV_LEN + TAG_LEN);
  const ctWithTag = new Uint8Array(ct.length + TAG_LEN);
  ctWithTag.set(ct, 0);
  ctWithTag.set(tag, ct.length);
  const key = await getKey();
  const pt = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ctWithTag),
  );
  return new TextDecoder().decode(pt);
}

/** Best-effort decrypt; returns null on failure (used when reading possibly-corrupted rows). */
export async function tryDecrypt(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    return await decrypt(token);
  } catch {
    return null;
  }
}
