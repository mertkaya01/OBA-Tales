/**
 * ROTALAR
 *   /             Ana Akın Haritası (tam ekran)
 *   /karakterler  Oba Kadrosu ve Nadirlik Dizini
 *   /bolumler     12 Bölümlük Sezon ve Boss Günlüğü
 *   /katil        Obaya Katıl ve Sınıf Rehberi
 *   /studyo       Reel Stüdyosu (dikey video çekimi; menüde yok, alt bilgiden açılır)
 *   *             Bulunamadı
 *
 * Sayfalar ayrı parçalar (chunk) halinde, yalnızca açıldıklarında yüklenir.
 */
import type { ComponentType } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import NotFoundPage, { RouteErrorPage } from "./pages/NotFoundPage";

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: LoadingScreen,
    children: [
      { index: true, lazy: page(() => import("./pages/MapPage")), handle: { fullBleed: true } },
      { path: "karakterler", lazy: page(() => import("./pages/CharactersPage")) },
      { path: "bolumler", lazy: page(() => import("./pages/EpisodesPage")) },
      { path: "katil", lazy: page(() => import("./pages/JoinPage")) },
      { path: "studyo", lazy: page(() => import("./pages/StudioPage")) },
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export const router = createBrowserRouter(routes);
