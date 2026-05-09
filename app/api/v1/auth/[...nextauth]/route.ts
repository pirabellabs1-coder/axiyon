// V1_FINAL — lazy-import NextAuth handlers to bypass module-load hang
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request, ctx: unknown) {
  const { GET: handler } = await import("@/auth");
  return (handler as (req: Request, ctx: unknown) => Promise<Response>)(req, ctx);
}

export async function POST(req: Request, ctx: unknown) {
  const { POST: handler } = await import("@/auth");
  return (handler as (req: Request, ctx: unknown) => Promise<Response>)(req, ctx);
}
