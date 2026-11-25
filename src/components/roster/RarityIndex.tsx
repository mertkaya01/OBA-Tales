/**
 * Nadirlik dizini — obada her nadirlikten kaç kahraman var? Bir kutuya tıklamak aşağıdaki ızgarayı o nadirliğe süzer.
 */
import { RARITY_INFO } from "../../content/rarities";
import { cn } from "../../lib/cn";
import type { RarityShare } from "../../lib/roster";
import { formatNumber } from "../../lib/text";
import type { Rarity } from "../../types";
import { RARITY_TEXT } from "../character/styles";

const SWATCH: Record<Rarity, string> = {
  siradan: "frame-siradan",
  nadir: "frame-nadir",
  destansi: "frame-destansi",
  efsanevi: "frame-efsanevi",
  ulu: "frame-ulu",
  goksel: "frame-goksel",
};

const BAR: Record<Rarity, string> = {
  siradan: "bg-yun-300",
  nadir: "bg-zumrut-400",
  destansi: "bg-mor-400",
  efsanevi: "bg-alev-400",
  ulu: "bg-ulu",
  goksel: "bg-goksel",
};

interface RarityIndexProps {
  shares: readonly RarityShare[];
  selected: readonly Rarity[];
  onToggle: (rarity: Rarity) => void;
}

export function RarityIndex({ shares, selected, onToggle }: RarityIndexProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {shares.map(({ rarity, count, percent }) => {
        const info = RARITY_INFO[rarity];
        const pressed = selected.includes(rarity);
        return (
          <li key={rarity}>
            <button
              type="button"
              aria-pressed={pressed}
              onClick={() => onToggle(rarity)}
              className={cn(
                "flex w-full flex-col gap-2 rounded-2xl border bg-gece-900/70 p-4 text-left transition-colors",
                pressed ? "border-gunozu-400/70 bg-gunozu-400/10" : "border-white/10 hover:border-white/25",
              )}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn("size-5 rounded-md border-2", SWATCH[rarity])} />
                <span className={cn("font-display text-lg", RARITY_TEXT[rarity])}>{info.label}</span>
                <span className="text-xs text-buz-300">· {info.title}</span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-3xl tabular-nums text-buz-50">{formatNumber(count)}</span>
                <span className="text-sm text-buz-300">kahraman · %{percent}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <span className={cn("block h-full rounded-full", BAR[rarity])} style={{ width: `${percent}%` }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
