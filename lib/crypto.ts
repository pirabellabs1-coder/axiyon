/**
 * AES-256-GCM encryption for sensitive data (OAuth tokens at rest).
 *
 * Uses node:crypto. Key is derived from `AXION_ENCRYPTION_KEY` env var
 * (32 bytes / 256 bits) — generate with:
 *   openssl rand -hex 32
 *
 * Format: iv(12) || authTag(16) || ciphertext  → base64url
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.AXION_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "Missing AXION_ENCRYPTION_KEY (or AUTH_SECRET fallback). Generate with `openssl rand -hex 32` and set in env.",
    );
  }
  // Normalize any input to a 32-byte key.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  // Otherwise hash it down to 32 bytes deterministically.
  return createHash("sha256").update(raw).digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([iv, tag, ct]));
}

export function decrypt(token: string): string {
  const buf = fromB64url(token);
  if (buf.length < 28) throw new Error("Invalid ciphertext");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Best-effort decrypt; returns null on failure (used when reading possibly-corrupted rows). */
export function tryDecrypt(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    return decrypt(token);
  } catch {
    return null;
  }
}
