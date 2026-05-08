/**
 * Renders any Lucide icon by name (string lookup).
 * Used everywhere agent templates are displayed instead of emojis.
 */
import { icons, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentIconProps {
  /** Lucide icon name as exported from lucide-react (e.g. "Phone", "BarChart3"). */
  name: string;
  /** Pixel size for the icon glyph itself. */
  size?: number;
  /** Tailwind classes for the icon (color, etc.). */
  className?: string;
  /** Wrapper container classes (background, border, padding, …). */
  wrapperClassName?: string;
  /** Render as a square tile with background and border (default true). */
  framed?: boolean;
  /** Add gradient background tile + colored icon. */
  gradient?: boolean;
}

const FALLBACK: LucideIcon = icons.Bot;

export function AgentIcon({
  name,
  size = 18,
  className,
  wrapperClassName,
  framed = true,
  gradient = false,
}: AgentIconProps) {
  const Icon = (icons[name as keyof typeof icons] as LucideIcon | undefined) ?? FALLBACK;
  const glyph = (
    <Icon
      size={size}
      strokeWidth={1.6}
      className={cn(gradient ? "text-white" : "text-brand-blue-2", className)}
    />
  );
  if (!framed) return glyph;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 rounded-md border",
        gradient
          ? "border-transparent bg-grad shadow-[0_0_18px_rgba(91,108,255,.35)]"
          : "border-line bg-bg-3",
        wrapperClassName ?? "size-11",
      )}
    >
      {glyph}
    </span>
  );
}
