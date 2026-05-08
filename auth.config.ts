/**
 * Edge-safe auth config.
 *
 * Imported by middleware (edge runtime). MUST NOT pull in node-only deps
 * like bcrypt or drizzle — those live exclusively in `auth.ts`.
 *
 * The `session` callback below hydrates the same shape that the full
 * `auth.ts` produces, but reads only the JWT (no DB hit). Middleware can
 * therefore inspect `session.user.isSuperuser` and `activeOrgId` without
 * loading the adapter.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        // We mirror what `auth.ts` writes into the JWT so the shape stays
        // identical between edge and node runtimes.
        (session.user as Record<string, unknown>).id = token.id ?? token.sub;
        (session.user as Record<string, unknown>).isSuperuser =
          (token.isSuperuser as boolean) ?? false;
        (session.user as Record<string, unknown>).activeOrgId =
          (token.activeOrgId as string | null) ?? null;
        (session.user as Record<string, unknown>).activeOrgRole =
          (token.activeOrgRole as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
