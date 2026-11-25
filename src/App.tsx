/**
 * Uygulama kökü: önce veriler yüklenir (DataProvider), sonra rotalar çizilir.
 * Geliştirme sırasında adres çubuğuna ?stres eklenirse 5000 takipçilik performans verisi kullanılır.
 */
import { RouterProvider } from "react-router/dom";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { DataProvider } from "./data/DataProvider";
import { resolveRosterUrl } from "./data/loaders";
import { router } from "./router";

const rosterUrl = resolveRosterUrl(window.location.search, import.meta.env.DEV);

export default function App() {
  return (
    <DataProvider rosterUrl={rosterUrl} loading={<LoadingScreen />}>
      <RouterProvider router={router} />
    </DataProvider>
  );
}
