/**
 * Seçilebilir filtre çipi. Basılıyken aria-pressed="true" olur (ekran okuyucular için).
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ChipProps {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Başta küçük simge ya da renk noktası. */
  icon?: ReactNode;
  /** Sağda sonuç sayısı. */
  count?: number;
  /** Basılıyken kullanılacak vurgu (Tailwind class'ları). Varsayılan: altın. */
  activeClassName?: string;
  className?: string;
}

export function Chip({ pressed, onToggle, children, icon, count, activeClassName, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
        pressed
          ? (activeClassName ?? "border-gunozu-400 bg-gunozu-400/20 text-gunozu-100")
          : "border-white/15 text-buz-200 hover:border-white/30 hover:bg-white/5",
        className,
      )}
    >
      {icon}
      <span>{children}</span>
      {count !== undefined && <span className="text-xs tabular-nums opacity-70">{count}</span>}
    </button>
  );
}
