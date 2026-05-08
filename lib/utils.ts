import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEur(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: v >= 100 ? 0 : 2,
  }).format(v);
}

export function formatNumber(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(v);
}

export function relativeTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const then = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - then.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}
