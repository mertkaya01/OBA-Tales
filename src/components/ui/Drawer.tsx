/**
 * Çekmece — masaüstünde sağdan açılan panel, mobilde alttan açılan sayfa.
 *
 * Harita açıkken kullanılabilsin diye engelleyici (modal) değildir: arkadaki haritaya tıklanabilir,
 * başka bir pine tıklayınca içerik değişir. Açılınca odak çekmeceye taşınır, Esc ile kapanır,
 * kapanınca odak açılmadan önceki öğeye geri döner.
 */
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Başlığın üstündeki küçük etiket. */
  eyebrow?: ReactNode;
}

export function Drawer({ open, onClose, title, children, eyebrow }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[80dvh] flex-col rounded-t-2xl border-t border-white/10 bg-gece-900/95 shadow-[0_-12px_40px_rgb(0_0_0/0.45)] outline-none backdrop-blur-md motion-safe:animate-sheet-in md:inset-x-auto md:bottom-0 md:right-0 md:top-14 md:max-h-none md:w-[400px] md:rounded-none md:border-t-0 md:border-l md:motion-safe:animate-drawer-in"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-xs uppercase tracking-widest text-buz-300">{eyebrow}</div>}
          <h2 id={titleId} className="truncate text-xl text-gunozu-300">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-buz-200 hover:bg-white/10 hover:text-buz-50"
          aria-label="Çekmeceyi kapat"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
    </aside>
  );
}
