"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // basePath must match the NextAuth basePath set in auth.ts so signIn()
  // from "next-auth/react" calls /api/v1/auth/* instead of the default /api/auth/*.
  return <SessionProvider basePath="/api/v1/auth">{children}</SessionProvider>;
}
