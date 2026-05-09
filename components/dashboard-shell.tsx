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
  Plug,
  Bell,
  Wallet,
  Brain,
  UserCog,
  Network,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/nav";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard, section: "Pilotage" },
  { href: "/dashboard/agents", label: "Agents", icon: Users, section: "Pilotage" },
  { href: "/dashboard/chat", label: "Chat live", icon: MessageSquare, section: "Pilotage" },
  { href: "/dashboard/workflows", label: "Workflows", icon: Workflow, section: "Pilotage" },
  { href: "/dashboard/tasks", label: "Tâches", icon: History, section: "Pilotage" },

  { href: "/dashboard/integrations", label: "Intégrations", icon: Plug, section: "Connexions" },
  { href: "/dashboard/memory", label: "Mémoire", icon: Brain, section: "Connexions" },
  { href: "/dashboard/knowledge-graph", label: "Knowledge graph", icon: Network, section: "Connexions" },

  { href: "/dashboard/approvals", label: "Approbations", icon: Bell, section: "Gouvernance" },
  { href: "/dashboard/audit", label: "Audit", icon: Shield, section: "Gouvernance" },

  { href: "/dashboard/team", label: "Équipe", icon: UserCog, section: "Compte" },
  { href: "/dashboard/billing", label: "Facturation", icon: Wallet, section: "Compte" },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings, section: "Compte" },
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
        <nav className="flex flex-col gap-0.5">
          {(() => {
            const sectioned: Array<{ section: string; items: NavItem[] }> = [];
            const seen = new Map<string, number>();
            for (const item of NAV) {
              const sec = item.section ?? "";
              if (!seen.has(sec)) {
                seen.set(sec, sectioned.length);
                sectioned.push({ section: sec, items: [] });
              }
              sectioned[seen.get(sec)!].items.push(item);
            }
            return sectioned.map((group, gi) => (
              <div key={group.section} className={gi > 0 ? "mt-4" : ""}>
                {group.section && (
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-3">
                    {group.section}
                  </div>
                )}
                {group.items.map((item) => {
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
              </div>
            ));
          })()}
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
