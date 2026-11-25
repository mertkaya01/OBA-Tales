/**
 * URL ↔ DURUM SENKRONU — filtreler, seçili karakter ve görünüm adres çubuğunda durur.
 *
 *   URL → depo : ilk açılışta ve geri/ileri tuşlarında
 *   depo → URL : filtre ya da seçim değişince (geçmişi kirletmemek için "replace" ile)
 *
 * Böylece "/?bolge=pusluada&k=isikay" gibi bir link paylaşılınca aynı görünüm açılır.
 * Filtre kullanan sayfalar (harita, kadro) bu hook'u bir kez çağırır.
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { URL_PARAMS } from "../types";
import { writeFiltersToSearchParams } from "../lib/filters";
import { useAppStore, type AppState } from "./useAppStore";

type UrlState = Pick<AppState, "filters" | "selectedId" | "view">;

/** Durumu URL parametrelerine yazar; diğer parametrelere dokunmaz. Varsayılan görünüm (dunya) yazılmaz. */
export function writeAppStateToSearchParams(state: UrlState, base?: URLSearchParams): URLSearchParams {
  const params = writeFiltersToSearchParams(state.filters, base);
  if (state.selectedId) params.set(URL_PARAMS.selected, state.selectedId);
  else params.delete(URL_PARAMS.selected);
  if (state.view !== "dunya") params.set(URL_PARAMS.view, state.view);
  else params.delete(URL_PARAMS.view);
  return params;
}

/** Virgülleri kodlamadan okunur bir sorgu metni: "sinif=okyeli,ocakcan" (%2C yerine). */
export function readableSearch(params: URLSearchParams): string {
  return params.toString().replace(/%2C/gi, ",");
}

export function useUrlSync(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  /** Son senkronlanan sorgu (URLSearchParams.toString biçiminde). Kendi yazdığımızı geri okumayalım. */
  const lastSynced = useRef<string | null>(null);

  // URL → depo
  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastSynced.current) return;
    lastSynced.current = current;
    useAppStore.getState().hydrateFromUrl(searchParams);
  }, [searchParams]);

  // depo → URL
  useEffect(
    () =>
      useAppStore.subscribe((state, prev) => {
        if (state.filters === prev.filters && state.selectedId === prev.selectedId && state.view === prev.view) return;
        const base = new URLSearchParams(window.location.search);
        const next = writeAppStateToSearchParams(state, base);
        if (next.toString() === base.toString()) return;
        lastSynced.current = next.toString();
        setSearchParams(readableSearch(next), { replace: true });
      }),
    [setSearchParams],
  );
}
