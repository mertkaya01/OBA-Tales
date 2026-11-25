/**
 * Küçük etiket: "Akında", "Kadro", "Yakında" gibi durumlar için.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type BadgeTone = "neutral" | "gold" | "ice" | "red" | "green" | "purple";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-white/15 bg-white/5 text-buz-200",
  gold: "border-gunozu-400/40 bg-gunozu-400/10 text-gunozu-200",
  ice: "border-buz-400/40 bg-buz-400/10 text-buz-100",
  red: "border-kilim-400/40 bg-kilim-500/15 text-kilim-400",
  green: "border-zumrut-400/40 bg-zumrut-500/15 text-zumrut-300",
  purple: "border-mor-400/40 bg-mor-500/15 text-mor-300",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ children, tone = "neutral", icon, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
