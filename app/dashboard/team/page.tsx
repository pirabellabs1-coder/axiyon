import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, orgMembers, users } from "@/lib/db";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user.activeOrgId) redirect("/login");
  const orgId = session.user.activeOrgId;

  const rows = await db
    .select({
      memberId: orgMembers.id,
      role: orgMembers.role,
      createdAt: orgMembers.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      isActive: users.isActive,
    })
    .from(orgMembers)
    .innerJoin(users, eq(users.id, orgMembers.userId))
    .where(eq(orgMembers.orgId, orgId));

  return (
    <TeamClient
      currentUserRole={session.user.activeOrgRole ?? "operator"}
      currentUserId={session.user.id}
      members={rows.map((r) => ({
        memberId: r.memberId,
        userId: r.userId,
        email: r.email,
        name: r.name,
        role: r.role,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
