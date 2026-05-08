/**
 * Edge-runtime middleware.
 *
 * IMPORTANT: must NOT import from `@/auth` (which pulls in bcrypt + drizzle
 * adapter, both incompatible with edge). Uses `auth.config.ts` instead — a
 * minimal config with no node-only deps.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/dashboard", "/admin"];
const ADMIN_ONLY = ["/admin"];
const AUTH_PAGES = ["/login", "/signup"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Static HTML files in /public are always served as-is — never gate them.
  if (pathname.endsWith(".html")) return NextResponse.next();

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_ONLY.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (!session && isProtected) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (isAdmin && session && !session.user?.isSuperuser) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.html).*)",
  ],
};
