/**
 * Nitelik çubukları — Güç, Çeviklik, Dayanıklılık, Kut (src/lib/attributes.ts).
 *
 * Takipçi ve kadroda çubuk 0–99 aralığını doldurur. Özel kahramanların değerleri tavanı aşar: çubuk taşar, nadirlik
 * renginde parlar ve yalnızca onlara ait nitelik en altta ayrıca gösterilir.
 */
import { ATTRIBUTE_CAP, ATTRIBUTE_INFO, attributesOf } from "../../lib/attributes";
import { cn } from "../../lib/cn";
import { ATTRIBUTE_IDS } from "../../types";
import type { Character } from "../../types";
import { RARITY_TEXT } from "./styles";

const BAR_FILL: Partial<Record<Character["rarity"], string>> = {
  ulu: "bg-linear-to-r from-gunozu-400 via-ulu to-white shadow-[0_0_10px_var(--color-ulu)]",
  goksel: "bg-linear-to-r from-buz-400 via-goksel to-white shadow-[0_0_12px_var(--color-goksel)]",
};

function Bar({ label, description, value, fill, overflow, tone }: { label: string; description: string; value: number; fill: string; overflow: boolean; tone: string }) {
  return (
    <li title={description}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-buz-200">{label}</span>
        <span className={cn("font-display tabular-nums", overflow ? tone : "text-buz-100")}>
          {value}
          {overflow && <span className="sr-only"> (tavanın üstünde)</span>}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="presentation">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(100, (value / ATTRIBUTE_CAP) * 100)}%` }} />
      </div>
    </li>
  );
}

export function AttributeBars({ character }: { character: Character }) {
  const sheet = attributesOf(character);
  const heroFill = BAR_FILL[character.rarity];
  const fill = sheet.heroic && heroFill ? heroFill : "bg-buz-300";

  return (
    <div>
      <ul className="space-y-2">
        {ATTRIBUTE_IDS.map((id) => (
          <Bar key={id} {...ATTRIBUTE_INFO[id]} value={sheet.values[id]} fill={fill} overflow={sheet.values[id] > ATTRIBUTE_CAP} tone={RARITY_TEXT[character.rarity]} />
        ))}
      </ul>
      {sheet.special && (
        <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-2.5">
          <div className="flex items-baseline justify-between">
            <span className={cn("font-display", RARITY_TEXT[character.rarity])}>{sheet.special.label}</span>
            <span className="font-display text-lg tabular-nums text-buz-50">{sheet.special.value}</span>
          </div>
          <p className="text-xs text-buz-300">{sheet.special.description} Yalnızca bu kahramanda.</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10" role="presentation">
            <div className={cn("h-full w-full rounded-full motion-safe:animate-pulse", heroFill ?? "bg-gunozu-300")} />
          </div>
        </div>
      )}
      {sheet.heroic && <p className="mt-2 text-xs text-buz-300">Özel kahraman: nitelikleri obanın {ATTRIBUTE_CAP} tavanını aşar.</p>}
    </div>
  );
}
