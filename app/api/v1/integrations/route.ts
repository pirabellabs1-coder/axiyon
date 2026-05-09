// V1_FINAL — ultra-minimal diagnostic
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now(), test: "minimal" });
}
