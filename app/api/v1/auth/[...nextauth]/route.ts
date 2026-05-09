// V1_FINAL — lazy-import NextAuth handlers to bypass module-load hang
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type AnyHandler = (req: unknown, ctx: unknown) => Promise<Response>;

export async function GET(req: Request, ctx: unknown) {
  const mod = await import("@/auth");
  return (mod.GET as unknown as AnyHandler)(req, ctx);
}

export async function POST(req: Request, ctx: unknown) {
  const mod = await import("@/auth");
  return (mod.POST as unknown as AnyHandler)(req, ctx);
}
