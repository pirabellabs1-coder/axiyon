/**
 * Auth.js v5 — credentials-only with JWT sessions.
 *
 * NOTE: we deliberately do NOT use DrizzleAdapter. With JWT session strategy
 * and a credentials provider, the adapter is unused but its constructor at
 * module load attempts to wire up the DB driver — which on serverless cold
 * starts can hang and bring down every API route that imports `@/auth`.
 * Skip it. We persist users via our own /api/auth/signup route.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, users, orgMembers } from "@/lib/db";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperuser: boolean;
      activeOrgId: string | null;
      activeOrgRole: string | null;
    } & DefaultSession["user"];
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,
  // Move handlers off the hung /api/auth/* path tree onto a fresh basePath.
  // The Vercel function bindings for /api/auth/* on this project are stuck
  // returning HTTP 000 timeouts; /api/v1/auth/* gets clean lambda IDs.
  basePath: "/api/v1/auth",

  providers: [
    Credentials({
      name: "Email + password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const r = raw as Record<string, unknown>;
        const email = typeof r?.email === "string" ? r.email.toLowerCase() : "";
        const password = typeof r?.password === "string" ? r.password : "";
        if (!email || !password) {
          throw new Error(`bad-input keys=${Object.keys(r ?? {}).join(",")}`);
        }
        try {
          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });
          if (!user) throw new Error(`no-user email=${email}`);
          if (!user.passwordHash) throw new Error("no-hash");
          if (!user.isActive) throw new Error("inactive");
          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) throw new Error(`bad-pw len=${password.length} hashlen=${user.passwordHash.length}`);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isSuperuser: user.isSuperuser,
          };
        } catch (e) {
          // NextAuth v5 swallows thrown errors but the message reaches /signin error handlers.
          throw new Error(`authorize-failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.isSuperuser = (user as { isSuperuser?: boolean }).isSuperuser ?? false;
        const m = await db.query.orgMembers.findFirst({
          where: eq(orgMembers.userId, user.id as string),
        });
        if (m) {
          token.activeOrgId = m.orgId;
          token.activeOrgRole = m.role;
        }
      }
      if (trigger === "update" && session?.activeOrgId) {
        const m = await db.query.orgMembers.findFirst({
          where: (om, { and, eq }) =>
            and(eq(om.userId, token.id as string), eq(om.orgId, session.activeOrgId as string)),
        });
        if (m) {
          token.activeOrgId = m.orgId;
          token.activeOrgRole = m.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = (token.id as string | undefined) ?? token.sub;
        u.isSuperuser = (token.isSuperuser as boolean) ?? false;
        u.activeOrgId = (token.activeOrgId as string | null) ?? null;
        u.activeOrgRole = (token.activeOrgRole as string | null) ?? null;
      }
      return session;
    },
  },
});
