/** Health check that imports @/lib/db to isolate where the hang is. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const start = Date.now();
  try {
    // Just a constant-time SELECT to confirm the DB pipe works.
    const r = await db.execute("select 1 as one");
    return NextResponse.json({
      ok: true,
      took_ms: Date.now() - start,
      result: r,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        took_ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
