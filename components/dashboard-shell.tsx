"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Workflow,
  MessageSquare,
  History,
  Settings,
  Shield,
  LogOut,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/nav";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "Agents", icon: Users },
  { href: "/dashboard/chat", label: "Chat live", icon: MessageSquare },
  { href: "/dashboard/workflows", label: "Workflows", icon: Workflow },
  { href: "/dashboard/tasks", label: "Tâches", icon: History },
  { href: "/dashboard/audit", label: "Audit", icon: Shield },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; isSuperuser?: boolean };
}) {
  const pathname = usePathname();
  const initials = (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="grid grid-cols-[240px_1fr] grid-rows-[56px_1fr] h-screen">
      {/* Top bar */}
      <header className="col-span-2 border-b border-line bg-bg-2 flex items-center px-5 gap-4">
        <Logo />
        <div className="flex-1" />
        {user.isSuperuser && (
          <Link
            href="/admin"
            className="text-xs uppercase tracking-wider font-mono text-brand-magenta hover:text-brand-magenta/80 px-2 py-1 rounded border border-brand-magenta/30 bg-brand-magenta/5"
          >
            Admin
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-ink-2 hover:text-ink p-2 rounded-md hover:bg-bg-3 transition-colors"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
        <div className="size-8 rounded-full bg-grad text-white text-xs font-semibold flex items-center justify-center">
          {initials}
        </div>
      </header>

      {/* Sidebar */}
      <aside className="border-r border-line bg-bg-2 p-3 overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-bg-3 text-ink"
                    : "text-ink-2 hover:bg-bg-3 hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/dashboard/agents/hire"
          className="mt-6 flex items-center justify-center gap-2 rounded-md bg-grad text-white py-2.5 text-sm font-medium shadow-glow hover:-translate-y-px transition-transform"
        >
          <Sparkles className="size-4" />
          Recruter +
        </Link>
      </aside>

      {/* Main */}
      <main className="overflow-y-auto bg-bg">
        <div className="p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
