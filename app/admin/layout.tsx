import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/nav";
import { LogOut } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperuser) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-bg-2 sticky top-0 z-10">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center gap-6">
          <Logo />
          <span className="text-[10px] uppercase tracking-widest font-mono text-brand-magenta border border-brand-magenta/40 bg-brand-magenta/10 rounded px-1.5 py-0.5">
            ADMIN
          </span>
          <nav className="flex gap-5 text-sm text-ink-2 ml-4">
            <Link href="/admin" className="hover:text-ink">
              Overview
            </Link>
            <Link href="/admin/orgs" className="hover:text-ink">
              Orgs
            </Link>
            <Link href="/admin/users" className="hover:text-ink">
              Users
            </Link>
            <Link href="/admin/system" className="hover:text-ink">
              Système
            </Link>
          </nav>
          <div className="flex-1" />
          <Link
            href="/dashboard"
            className="text-sm text-ink-2 hover:text-ink"
          >
            ← Retour au dashboard
          </Link>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
