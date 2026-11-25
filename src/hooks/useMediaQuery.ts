/**
 * CSS medya sorgusunu dinler: useMediaQuery("(min-width: 768px)") → masaüstü mü?
 */
import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind'in md kırılımı (768 px) ve üstü. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
