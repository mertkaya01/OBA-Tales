/**
 * Oyun verisine erişim hook'ları.
 *
 *   useGameData()       → yüklenmiş veri (DataProvider yükleme bitince çocuklarını render eder)
 *   useGameDataState()  → yükleme durumu ve "tekrar yükle" fonksiyonu
 */
import { createContext, useContext } from "react";
import type { GameData } from "./loaders";

export type GameDataState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: GameData };

export interface GameDataContextValue {
  state: GameDataState;
  reload: () => void;
}

export const GameDataContext = createContext<GameDataContextValue | null>(null);

export function useGameDataState(): GameDataContextValue {
  const ctx = useContext(GameDataContext);
  if (!ctx) throw new Error("useGameDataState yalnızca <DataProvider> içinde kullanılabilir");
  return ctx;
}

export function useGameData(): GameData {
  const { state } = useGameDataState();
  if (state.status !== "ready") {
    throw new Error("Veri henüz hazır değil: useGameData yalnızca <DataProvider> yüklemeyi bitirdikten sonra kullanılabilir");
  }
  return state.data;
}
