import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: "node",
    nodeVersion: process.version,
    region: process.env.VERCEL_REGION ?? "?",
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasEncryptionKey: !!process.env.AXION_ENCRYPTION_KEY,
    timestamp: new Date().toISOString(),
  });
}
