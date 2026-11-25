/**
 * Sayfa iskeleti: üst menü + sayfa içeriği + alt bilgi.
 * Rota `handle: { fullBleed: true }` taşıyorsa (harita) içerik ekranı kaplar ve alt bilgi gizlenir.
 */
import { Outlet, ScrollRestoration, useMatches } from "react-router";
import { cn } from "../../lib/cn";
import { Footer } from "./Footer";
import { Header } from "./Header";

function isFullBleed(handle: unknown): boolean {
  return typeof handle === "object" && handle !== null && "fullBleed" in handle && handle.fullBleed === true;
}

export function AppLayout() {
  const fullBleed = useMatches().some((match) => isFullBleed(match.handle));

  return (
    <div className={cn("flex flex-col", fullBleed ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <a
        href="#icerik"
        className="sr-only z-50 rounded-lg bg-gunozu-400 px-4 py-2 font-display text-gece-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        İçeriğe geç
      </a>
      <Header />
      <main
        id="icerik"
        className={cn("flex-1", fullBleed ? "relative flex min-h-0 flex-col" : "mx-auto w-full max-w-6xl px-4 py-8 sm:py-10")}
      >
        <Outlet />
      </main>
      {!fullBleed && <Footer />}
      <ScrollRestoration />
    </div>
  );
}
