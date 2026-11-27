/**
 * Hızlı görünümler (3D dünyanın alt ortası): tek tıkla Konuk obası, Kut Kapısı, Kutada (açık adalar) ve bütün dünya.
 * Tanıtım turu ya da geliş sineması sürerken gizlenir (onların kartı da alt ortada).
 */
import { cn } from "../../lib/cn";

export interface QuickView {
  id: string;
  label: string;
  title: string;
  go: () => void;
}

export function QuickViews({ views, className }: { views: readonly QuickView[]; className?: string }) {
  return (
    <nav aria-label="Hızlı görünümler" className={cn("flex overflow-hidden rounded-xl border border-white/15 bg-gece-900/90 shadow-lg backdrop-blur", className)}>
      {views.map((v, i) => (
        <button
          key={v.id}
          type="button"
          onClick={v.go}
          title={v.title}
          className={cn("px-3 py-2 font-display text-xs text-buz-100 transition-colors hover:bg-white/10 hover:text-gunozu-200 sm:text-sm", i > 0 && "border-l border-white/10")}
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
}
