/**
 * Auth.js v5 (NextAuth) configuration.
 *
 * Credentials provider with bcrypt-hashed passwords. Drizzle adapter persists
 * sessions/accounts. Session strategy is JWT (stateless) so middleware can
 * read it from the cookie without a DB hit.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
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
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,

  providers: [
    Credentials({
      name: "Email + password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, parsed.data.email),
        });
        if (!user || !user.passwordHash || !user.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperuser: user.isSuperuser,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.isSuperuser = (user as { isSuperuser?: boolean }).isSuperuser ?? false;
        // Resolve the user's first org as their active one
        const m = await db.query.orgMembers.findFirst({
          where: eq(orgMembers.userId, user.id as string),
        });
        if (m) {
          token.activeOrgId = m.orgId;
          token.activeOrgRole = m.role;
        }
      }
      // Allow client-triggered org switch via session.update({ activeOrgId })
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
        session.user.id = token.id as string;
        session.user.isSuperuser = (token.isSuperuser as boolean) ?? false;
        session.user.activeOrgId = (token.activeOrgId as string | null) ?? null;
        session.user.activeOrgRole = (token.activeOrgRole as string | null) ?? null;
      }
      return session;
    },
  },
});
