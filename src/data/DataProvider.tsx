/**
 * Veri sağlayıcı — uygulamanın en dışında durur.
 * Veriler yüklenene kadar `loading` içeriğini, hata olursa `renderError` içeriğini gösterir;
 * hazır olunca çocuklarını render eder. Böylece içerideki bileşenler useGameData() ile veriyi
 * "yükleniyor mu?" diye düşünmeden kullanabilir.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { prepareTerrain } from "../game/terrainWorker";
import { clearDataCache, loadGameData } from "./loaders";
import { GameDataContext, type GameDataState } from "./useGameData";

interface DataProviderProps {
  children: ReactNode;
  /** Varsayılan roster yerine başka bir dosya (ör. ?stres ile performans verisi). */
  rosterUrl?: string;
  /** Yüklenirken gösterilecek içerik. */
  loading?: ReactNode;
  /** Hata ekranı. */
  renderError?: (error: Error, retry: () => void) => ReactNode;
}

export function DataProvider({ children, rosterUrl, loading, renderError }: DataProviderProps) {
  const [state, setState] = useState<GameDataState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    // Veriler gelince arazi de arka planda hazırlanır; ikisi bitince harita açılır.
    loadGameData({ rosterUrl })
      .then((data) => prepareTerrain(data.world.seed).then(() => data))
      .then(
      (data) => {
        if (active) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (active) setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      active = false;
    };
  }, [rosterUrl, attempt]);

  const reload = useCallback(() => {
    clearDataCache();
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ state, reload }), [state, reload]);

  let content: ReactNode;
  if (state.status === "ready") content = children;
  else if (state.status === "error") content = (renderError ?? defaultError)(state.error, reload);
  else content = loading ?? <p style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>Harita hazırlanıyor…</p>;

  return <GameDataContext value={value}>{content}</GameDataContext>;
}

function defaultError(error: Error, retry: () => void) {
  return (
    <div role="alert" style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2>Harita yüklenemedi</h2>
      <p>Bağlantını kontrol edip tekrar dener misin?</p>
      <button type="button" onClick={retry}>
        Tekrar dene
      </button>
      <details style={{ marginTop: 16 }}>
        <summary>Teknik ayrıntı</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
      </details>
    </div>
  );
}
