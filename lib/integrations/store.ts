/**
 * Integration store — encrypted token persistence + retrieval.
 *
 * Tokens are encrypted with AES-256-GCM at write time and only decrypted
 * lazily via `getDecryptedToken()`. Refresh is handled automatically when
 * the stored expiry is < 60 s away.
 */
import { and, eq } from "drizzle-orm";
import { db, integrations, type Integration } from "@/lib/db";
import { decrypt, encrypt, tryDecrypt } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  fetchProviderProfile,
  refreshOauthToken,
} from "./oauth";
import { getProvider, type ApiKeyFlow, type ProviderDef } from "./providers";

export interface DecryptedIntegration {
  id: string;
  orgId: string;
  provider: string;
  scope: string | null;
  accountId: string | null;
  accountEmail: string | null;
  accountName: string | null;
  /** Decrypted access token. Use for API calls. */
  accessToken: string;
  /** Decrypted refresh token (if any). */
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  status: "connected" | "expired" | "revoked" | "error";
}

export async function listOrgIntegrations(orgId: string): Promise<Integration[]> {
  return db.select().from(integrations).where(eq(integrations.orgId, orgId)).orderBy(integrations.createdAt);
}

export async function findActiveIntegration(
  orgId: string,
  providerSlug: string,
): Promise<Integration | null> {
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.orgId, orgId),
        eq(integrations.provider, providerSlug),
        eq(integrations.status, "connected"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get a decrypted, ready-to-use integration. Auto-refreshes the access token
 * if the stored one is about to expire and a refresh token exists.
 *
 * Returns null if no active integration is connected.
 */
export async function getActiveIntegration(
  orgId: string,
  providerSlug: string,
): Promise<DecryptedIntegration | null> {
  const row = await findActiveIntegration(orgId, providerSlug);
  if (!row) return null;

  let accessToken = decrypt(row.accessTokenEnc);
  const refreshToken = tryDecrypt(row.refreshTokenEnc);
  let expiresAt = row.expiresAt ?? null;

  // Auto-refresh if expiring within 60s
  if (expiresAt && expiresAt.getTime() - Date.now() < 60_000 && refreshToken) {
    const provider = getProvider(providerSlug);
    if (provider?.flow.type === "oauth2") {
      try {
        const refreshed = await refreshOauthToken(provider, refreshToken);
        accessToken = refreshed.accessToken;
        expiresAt = refreshed.expiresAt ?? null;

        await db
          .update(integrations)
          .set({
            accessTokenEnc: encrypt(refreshed.accessToken),
            refreshTokenEnc: refreshed.refreshToken
              ? encrypt(refreshed.refreshToken)
              : row.refreshTokenEnc,
            expiresAt: refreshed.expiresAt ?? null,
            status: "connected",
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, row.id));
      } catch {
        await db
          .update(integrations)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(integrations.id, row.id));
        return null;
      }
    }
  }

  // Mark "last used"
  await db
    .update(integrations)
    .set({ lastUsedAt: new Date() })
    .where(eq(integrations.id, row.id))
    .catch(() => undefined);

  return {
    id: row.id,
    orgId: row.orgId,
    provider: row.provider,
    scope: row.scope,
    accountId: row.accountId,
    accountEmail: row.accountEmail,
    accountName: row.accountName,
    accessToken,
    refreshToken,
    expiresAt,
    scopes: row.scopes ?? [],
    metadata: row.metadata ?? {},
    status: row.status as DecryptedIntegration["status"],
  };
}

/** Persist an OAuth connection — fetches the user profile then encrypts tokens. */
export async function persistOauthConnection(args: {
  orgId: string;
  provider: ProviderDef;
  code: string;
}): Promise<Integration> {
  const tokens = await exchangeCodeForToken(args.provider, args.code);
  const profile = await fetchProviderProfile(args.provider, tokens.accessToken);

  const existing = await findActiveIntegration(args.orgId, args.provider.slug);

  const values = {
    orgId: args.orgId,
    provider: args.provider.slug,
    scope: null,
    accountId: profile.accountId ?? null,
    accountEmail: profile.accountEmail ?? null,
    accountName: profile.accountName ?? args.provider.name,
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt ?? null,
    scopes: tokens.scopes,
    metadata: { profile: profile as Record<string, unknown> },
    status: "connected" as const,
    connectedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(integrations)
      .set(values)
      .where(eq(integrations.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db.insert(integrations).values(values).returning();
  return row;
}

/** Persist an API-key (non-OAuth) connection. Verifies creds when possible. */
export async function persistApiKeyConnection(args: {
  orgId: string;
  provider: ProviderDef;
  fields: Record<string, string>;
}): Promise<Integration> {
  if (args.provider.flow.type !== "api_key") throw new Error("Not an api_key provider");
  const flow = args.provider.flow as ApiKeyFlow;

  // Optional verification ping
  if (flow.verifyUrl) {
    let ok = false;
    try {
      const url = flow.verifyUrl.replace(
        /\{(\w+)\}/g,
        (_, k: string) => encodeURIComponent(args.fields[k] ?? ""),
      );
      const headers: Record<string, string> = { Accept: "application/json" };
      if (args.provider.slug === "twilio") {
        headers.Authorization =
          "Basic " +
          Buffer.from(`${args.fields.account_sid}:${args.fields.auth_token}`).toString("base64");
      } else if (args.provider.slug === "stripe") {
        headers.Authorization = `Bearer ${args.fields.secret_key}`;
      } else if (args.fields.api_key) {
        headers.Authorization = `Bearer ${args.fields.api_key}`;
      }
      const r = await fetch(url, { headers });
      ok = r.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new Error("Vérification des identifiants échouée — re-vérifiez les valeurs.");
    }
  }

  const ciphertext = encrypt(JSON.stringify(args.fields));

  const existing = await findActiveIntegration(args.orgId, args.provider.slug);
  const values = {
    orgId: args.orgId,
    provider: args.provider.slug,
    scope: null,
    accountId: args.fields.account_sid ?? args.fields.from_email ?? null,
    accountEmail: args.fields.from_email ?? null,
    accountName: args.fields.from_name ?? args.provider.name,
    accessTokenEnc: ciphertext,
    refreshTokenEnc: null,
    expiresAt: null,
    scopes: [],
    metadata: { fields: Object.keys(args.fields) },
    status: "connected" as const,
    connectedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(integrations)
      .set(values)
      .where(eq(integrations.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(integrations).values(values).returning();
  return row;
}

export async function disconnectIntegration(orgId: string, integrationId: string): Promise<void> {
  await db
    .delete(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.id, integrationId)));
}

/** Decrypt API-key fields stored on an api_key integration. */
export async function getApiKeyFields(
  orgId: string,
  providerSlug: string,
): Promise<Record<string, string> | null> {
  const row = await findActiveIntegration(orgId, providerSlug);
  if (!row) return null;
  try {
    return JSON.parse(decrypt(row.accessTokenEnc)) as Record<string, string>;
  } catch {
    return null;
  }
}
