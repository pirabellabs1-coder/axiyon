"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
      <span className="relative size-7 rounded-[7px] bg-grad shadow-[0_0_28px_rgba(91,108,255,.4)]">
        <span className="absolute inset-[5px] rounded-[3px] bg-bg" />
        <span className="absolute inset-[9px] rounded-[1px] bg-grad" />
      </span>
      Axion
    </Link>
  );
}

export function MarketingNav({ session }: { session?: { name?: string | null } | null }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links: NavLink[] = [
    { href: "/product", label: "Produit" },
    { href: "/agents", label: "Catalogue" },
    { href: "/pricing", label: "Tarifs" },
    { href: "/manifesto", label: "Manifesto" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 backdrop-blur-md transition-all duration-300",
        scrolled
          ? "bg-bg/85 border-b border-line py-3"
          : "bg-bg/50 py-[18px]",
      )}
    >
      <div className="container-x flex items-center justify-between gap-8">
        <Logo />
        <div className="hidden md:flex gap-8 text-sm text-ink-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          {session ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/dashboard">Dashboard →</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Connexion</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/signup">Démarrer →</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
