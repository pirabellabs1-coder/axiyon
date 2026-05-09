// V1_FINAL — minimal edge runtime
export const runtime = "edge";

export async function GET() {
  return new Response(JSON.stringify({ ok: true, ts: Date.now(), test: "edge" }), {
    headers: { "content-type": "application/json" },
  });
}
