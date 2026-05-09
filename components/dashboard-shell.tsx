"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
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
  Menu,
  X,
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

const STORAGE_KEY = "axion.sidebar.collapsed";

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; isSuperuser?: boolean };
}) {
  const pathname = usePathname();
  const initials = (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase();

  // Desktop: collapsed (icons-only) vs expanded. Persisted to localStorage.
  // Mobile: open (drawer overlay) vs closed.
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function toggleDesktop() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      className={cn(
        "h-screen grid grid-rows-[56px_1fr] transition-[grid-template-columns] duration-200",
        // grid-cols controls desktop width; mobile overlays via fixed positioning
        collapsed
          ? "md:grid-cols-[64px_1fr]"
          : "md:grid-cols-[240px_1fr]",
        "grid-cols-[1fr]", // mobile: single col, sidebar is fixed overlay
      )}
    >
      {/* Top bar */}
      <header className="row-start-1 col-span-full border-b border-line bg-bg-2 flex items-center px-3 md:px-5 gap-2 md:gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 rounded-md hover:bg-bg-3 text-ink-2 hover:text-ink"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" strokeWidth={2} />
        </button>
        {/* Desktop collapse toggle */}
        <button
          onClick={toggleDesktop}
          className="hidden md:inline-flex p-2 rounded-md hover:bg-bg-3 text-ink-2 hover:text-ink"
          aria-label={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
          title={collapsed ? "Déplier" : "Replier"}
        >
          <Menu className="size-4" strokeWidth={2} />
        </button>
        <Logo />
        <div className="flex-1" />
        {user.isSuperuser && (
          <Link
            href="/admin"
            className="hidden sm:inline text-[10px] md:text-xs uppercase tracking-wider font-mono text-brand-magenta hover:text-brand-magenta/80 px-2 py-1 rounded border border-brand-magenta/30 bg-brand-magenta/5"
          >
            Admin
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-ink-2 hover:text-ink p-2 rounded-md hover:bg-bg-3 transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
        <div className="size-8 rounded-full bg-grad text-white text-xs font-semibold flex items-center justify-center">
          {initials}
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu"
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar — fixed/overlay on mobile, normal grid item on desktop */}
      <aside
        className={cn(
          "row-start-2 border-r border-line bg-bg-2 overflow-y-auto z-50",
          // Desktop: normal grid placement, width controlled by grid
          "md:relative md:translate-x-0",
          // Mobile: fixed overlay sliding in from left
          "fixed top-[56px] bottom-0 left-0 w-[260px] transition-transform duration-200 md:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "p-2" : "p-3",
        )}
      >
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
                {group.section && !collapsed && (
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
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center rounded-md text-sm transition-colors",
                        collapsed
                          ? "justify-center p-2.5"
                          : "gap-3 px-3 py-2",
                        active
                          ? "bg-bg-3 text-ink"
                          : "text-ink-2 hover:bg-bg-3 hover:text-ink",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ));
          })()}
        </nav>

        <Link
          href="/dashboard/agents/hire"
          title={collapsed ? "Recruter un agent" : undefined}
          className={cn(
            "mt-6 flex items-center justify-center rounded-md bg-grad text-white text-sm font-medium shadow-glow hover:-translate-y-px transition-transform",
            collapsed ? "p-2.5" : "gap-2 py-2.5",
          )}
        >
          <Sparkles className="size-4" />
          {!collapsed && <span>Recruter +</span>}
        </Link>

        {/* Mobile close button at bottom */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-line text-ink-2 hover:text-ink text-sm"
          >
            <X className="size-4" /> Fermer
          </button>
        )}
      </aside>

      {/* Main */}
      <main className="row-start-2 overflow-y-auto bg-bg">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>

      {/* Avoid hydration mismatch flash on the collapsed state */}
      {!mounted && (
        <style jsx global>{`
          aside[data-no-flash] {
            visibility: hidden;
          }
        `}</style>
      )}
    </div>
  );
}
