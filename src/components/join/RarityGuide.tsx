/**
 * Nadirlik rehberi: dört kademe, aynı yoldaşın her kademedeki görünüşüyle (çerçeve, kıyafet, aura).
 */
import { useMemo } from "react";
import { RARITY_LIST } from "../../content/rarities";
import { cn } from "../../lib/cn";
import { defaultTitle } from "../../lib/rules";
import { previewNewcomer } from "../../lib/roster";
import type { Character } from "../../types";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { RARITY_TEXT } from "../character/styles";

export function RarityGuide() {
  const base = useMemo(() => previewNewcomer("ayaz_yolcu", ["youtube"])!, []);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {RARITY_LIST.map((rarity) => {
        const sample: Character = { ...base, rarity: rarity.id, title: defaultTitle(rarity.id, base.class.id) };
        return (
          <li key={rarity.id} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-gece-900/70 p-4 text-center">
            <CharacterPortrait character={sample} size="lg" alt={`${rarity.label} kademesinde örnek yoldaş`} className="my-1" />
            <h3 className={cn("font-display text-xl", RARITY_TEXT[rarity.id])}>{rarity.label}</h3>
            <p className="-mt-1 text-sm text-buz-200">Unvan: {rarity.title}</p>
            <p className="text-sm text-buz-300">{rarity.description}</p>
            <p className="text-xs text-buz-300">
              <b className={cn("font-semibold", RARITY_TEXT[rarity.id])}>{rarity.frameLabel}</b>
            </p>
            <ul className="mt-auto flex flex-wrap justify-center gap-1.5 pt-1">
              {rarity.visuals.map((v) => (
                <li key={v} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-buz-200">
                  {v}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
