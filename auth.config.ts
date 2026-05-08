/**
 * Edge-safe auth config — imported by middleware.
 *
 * Anything that needs Node-only APIs (bcrypt, drizzle, etc.) MUST live in
 * the main auth.ts which is imported only by route handlers running on Node.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,
  // Providers are listed without their `authorize` body here — middleware doesn't
  // need to know how to authenticate, only what session tokens look like.
  providers: [],
  callbacks: {
    authorized: ({ auth: session, request }) => {
      // Default: allow. Page-level + route-level checks happen elsewhere.
      const path = request.nextUrl.pathname;
      const protectedPaths = ["/dashboard", "/admin"];
      const isProtected = protectedPaths.some((p) => path.startsWith(p));
      if (isProtected && !session) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
