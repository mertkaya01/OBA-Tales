/**
 * ADALAR SAATİ — gün ve gecenin hangi saatte olduğu.
 *
 * Varsayılan: gerçek İstanbul saati (herkes aynı anda aynı akşamı görür).
 *   ?saat=21 ya da ?saat=21:30  → saati sabitler (denemek ve ekran görüntüsü için)
 *   Hızlı zaman                 → saat düğmesine basınca bir gün 2 dakikada geçer
 *
 * 3D dünya ışıkları her karede bu ayarlardan saati hesaplar; arayüzdeki saat de aynı kaynağı okur.
 */
import { create } from "zustand";
import { currentWorldHour, parseHourOverride, type WorldTimeSettings } from "../world3d/living/sky";

interface WorldTimeState {
  settings: WorldTimeSettings;
  toggleTimeLapse: () => void;
  /** Ayarları doğrudan değiştirir (Reel Stüdyosu saat seçer, çıkarken eskisini geri koyar). */
  setSettings: (settings: WorldTimeSettings) => void;
}

export const useWorldTime = create<WorldTimeState>()((set) => ({
  settings: {
    override: typeof window === "undefined" ? null : parseHourOverride(window.location.search),
    lapse: null,
  },
  toggleTimeLapse: () =>
    set(({ settings }) => {
      if (settings.lapse) return { settings: { ...settings, lapse: null } };
      const now = Date.now();
      return { settings: { ...settings, lapse: { startedAt: now, startHour: currentWorldHour(now, settings) } } };
    }),
  setSettings: (settings) => set({ settings }),
}));

/** Şu anki adalar saati (her çağrıda yeniden hesaplanır). */
export function readWorldHour(nowMs: number = Date.now()): number {
  return currentWorldHour(nowMs, useWorldTime.getState().settings);
}
