/**
 * TEK CANLI PIXI SAHNESİ — tarayıcıların WebGL bağlamı sınırlı (3D dünya da bir tane kullanıyor).
 *
 * Canlı sahne isteyen her yer sıraya girer; yalnızca en son giren canlı çizilir, diğerleri durağan
 * görüntüsünü gösterir. Ör. karakter çekmecesi açıkken akın paneli açılırsa portre durağan kalır,
 * panel kapanınca yeniden canlanır.
 */
import { useEffect } from "react";
import { create } from "zustand";

interface PixiLeaseState {
  stack: readonly string[];
  acquire: (owner: string) => void;
  release: (owner: string) => void;
}

export const usePixiLease = create<PixiLeaseState>()((set) => ({
  stack: [],
  acquire: (owner) => set((s) => ({ stack: [...s.stack.filter((o) => o !== owner), owner] })),
  release: (owner) => set((s) => ({ stack: s.stack.filter((o) => o !== owner) })),
}));

/** Sıraya girer (wanted iken) ve canlı sahnenin bu sahibe ait olup olmadığını döndürür. */
export function usePixiTurn(owner: string, wanted: boolean): boolean {
  const acquire = usePixiLease((s) => s.acquire);
  const release = usePixiLease((s) => s.release);
  const isTop = usePixiLease((s) => s.stack[s.stack.length - 1] === owner);

  useEffect(() => {
    if (!wanted) return;
    acquire(owner);
    return () => release(owner);
  }, [owner, wanted, acquire, release]);

  return wanted && isTop;
}
