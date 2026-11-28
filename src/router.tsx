/**
 * ROTALAR
 *   /             Harita (tam ekran)
 *   /karakterler  Oba Kadrosu ve Nadirlik Dizini
 *   /bolumler     12 Bölümlük Sezon ve Boss Günlüğü
 *   /katil        Obaya Katıl ve Sınıf Rehberi
 *   /studyo       Reel Stüdyosu (dikey video çekimi; menüde yok, alt bilgiden açılır)
 *   *             Bulunamadı
 *
 * Sayfalar ayrı parçalar (chunk) halinde, yalnızca açıldıklarında yüklenir.
 */
import type { ComponentType } from "react";
import { createBrowserRouter, type RouteObject, redirect } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { reloadForNewBuild, withStaleReload } from "./lib/staleBuild";
import NotFoundPage, { RouteErrorPage } from "./pages/NotFoundPage";

/**
 * Eski sürümden kalan sekmede sayfa parçası bulunamazsa sayfa yenilenir (lib/staleBuild.ts). path verilirse yenileme
 * o sayfayı açar: menüden "Oba Kadrosu"na tıklayan haritada kalmaz, kadroya gelir.
 */
const page = (load: () => Promise<{ default: ComponentType }>, path?: string) => {
  const goTo = path ? () => window.location.assign(path) : undefined;
  const safeLoad = withStaleReload(load, () => reloadForNewBuild(Date.now(), undefined, goTo));
  return async () => ({ Component: (await safeLoad()).default });
};

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: LoadingScreen,
    children: [
      { index: true, lazy: page(() => import("./pages/MapPage")), handle: { fullBleed: true } },
      { path: "karakterler", lazy: page(() => import("./pages/CharactersPage"), "/karakterler") },
      // Sezon sayfası kalktı (akın videoları platformlarda paylaşılıyor); eski bağlantılar haritaya döner.
      { path: "bolumler", loader: () => redirect("/") },
      { path: "katil", lazy: page(() => import("./pages/JoinPage"), "/katil") },
      { path: "studyo", lazy: page(() => import("./pages/StudioPage"), "/studyo") },
      // Yönetim paneli yalnızca geliştirme sunucusunda (npm run dev): yayın sürümüne girmez.
      ...(import.meta.env.DEV ? [{ path: "yonetim", lazy: page(() => import("./pages/AdminPage")) }] : []),
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export const router = createBrowserRouter(routes);
