import { redirect } from "next/navigation";
import Script from "next/script";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, orgs } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch the active org for the topbar breadcrumb (Helia › Production style).
  const org = session.user.activeOrgId
    ? await db.query.orgs.findFirst({ where: eq(orgs.id, session.user.activeOrgId) })
    : null;

  return (
    <>
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          isSuperuser: session.user.isSuperuser,
        }}
        org={
          org
            ? {
                name: org.name,
                env: (org.tier ?? "Production") === "solo" ? "Solo" : "Production",
              }
            : null
        }
      >
        {children}
      </DashboardShell>
      {/* AI engine — loaded only inside the authenticated dashboard. */}
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
    </>
  );
}
