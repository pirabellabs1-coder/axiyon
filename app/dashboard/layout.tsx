import { redirect } from "next/navigation";
import Script from "next/script";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <>
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          isSuperuser: session.user.isSuperuser,
        }}
      >
        {children}
      </DashboardShell>
      {/* AI engine — loaded only inside the authenticated dashboard. */}
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
    </>
  );
}
