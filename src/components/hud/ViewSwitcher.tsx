/**
 * Dünya (Three.js) ↔ Harita (Leaflet) görünüm düğmeleri.
 * Dünya görünümü kullanılamıyorsa (henüz hazır değil ya da WebGL yok) düğmesi pasif kalır.
 */
import { Globe2, Map as MapIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import type { ViewMode } from "../../types";

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
  worldAvailable: boolean;
  /** Dünya düğmesi pasifken gösterilecek açıklama. */
  worldUnavailableReason?: string;
  className?: string;
}

const OPTIONS = [
  { value: "dunya", label: "Dünya", Icon: Globe2 },
  { value: "harita", label: "Harita", Icon: MapIcon },
] as const;

export function ViewSwitcher({ value, onChange, worldAvailable, worldUnavailableReason, className }: ViewSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Görünüm"
      className={cn("flex rounded-xl border border-white/15 bg-gece-900/90 p-1 shadow-lg backdrop-blur", className)}
    >
      {OPTIONS.map(({ value: option, label, Icon }) => {
        const disabled = option === "dunya" && !worldAvailable;
        const pressed = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            title={disabled ? worldUnavailableReason : undefined}
            onClick={() => onChange(option)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-sm transition-colors",
              pressed ? "bg-gunozu-400 text-gece-950" : "text-buz-200 hover:bg-white/10",
              disabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
