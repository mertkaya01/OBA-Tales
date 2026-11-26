/**
 * ADA SESLERİ AÇIK MI? — haritadaki ses düğmesi açar, sahnedeki yönlendirici (KutadaSoundDirector) çalar.
 * Tarayıcılar sesi ancak bir tıklamadan sonra başlattığı için ses her açılışta kapalıdır.
 */
import { create } from "zustand";
import { KutadaSound } from "../audio/kutadaSound";

interface KutadaSoundState {
  engine: KutadaSound | null;
  toggle: () => Promise<void>;
  stop: () => void;
}

export const useKutadaSound = create<KutadaSoundState>()((set, get) => ({
  engine: null,
  toggle: async () => {
    const current = get().engine;
    if (current) {
      set({ engine: null });
      void current.close();
      return;
    }
    const sound = new KutadaSound();
    set({ engine: sound });
    await sound.resume();
  },
  stop: () => {
    const current = get().engine;
    if (!current) return;
    set({ engine: null });
    void current.close();
  },
}));
