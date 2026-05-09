// V1_FINAL — diagnostic-only auth probe
import { z } from "zod";

export const runtime = "edge";

const Body = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 422 });
  }

  const [{ default: bcrypt }, { eq }, { db, users }] = await Promise.all([
    import("bcryptjs"),
    import("drizzle-orm"),
    import("@/lib/db"),
  ]);

  const user = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });
  if (!user) return Response.json({ found: false }, { status: 200 });

  const hashLen = user.passwordHash?.length ?? 0;
  const hashPrefix = user.passwordHash?.slice(0, 7) ?? "";
  const ok = user.passwordHash
    ? await bcrypt.compare(body.password, user.passwordHash)
    : false;

  return Response.json({
    found: true,
    isActive: user.isActive,
    isSuperuser: user.isSuperuser,
    hasPasswordHash: !!user.passwordHash,
    hashLen,
    hashPrefix,
    bcryptCompareResult: ok,
  });
}
