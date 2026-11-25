/**
 * Çoklu takip kuralları: aynı yoldaş bir, iki ve üç platformda takip edince nasıl başlar?
 *   1 platform  → Sıradan (Çırak)
 *   2 platform  → bir kademe yukarı: Nadir (Yoldaş) + Çift İz rozeti
 *   3 platform  → Nadir (Yoldaş) + Oba Öncülüğü rozeti
 * Ana platform (ilk takip edilen) sınıfı belirler; diğerleri yalnızca nadirliği ve rozeti etkiler.
 */
import { ChevronRight } from "lucide-react";
import { Fragment, useMemo } from "react";
import { PLATFORM_LABELS } from "../../content/classes";
import { RARITY_INFO } from "../../content/rarities";
import { cn } from "../../lib/cn";
import { previewNewcomer } from "../../lib/roster";
import type { Platform } from "../../types";
import { BadgeList } from "../character/BadgeList";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { PlatformIcon } from "../character/PlatformIcon";
import { RARITY_TEXT } from "../character/styles";

const STEPS: readonly { platforms: Platform[]; note: string }[] = [
  { platforms: ["instagram"], note: "Ana platformun sınıfını belirler." },
  { platforms: ["instagram", "tiktok"], note: "İkinci iz: nadirlik bir kademe yükselir." },
  { platforms: ["instagram", "tiktok", "youtube"], note: "Üç kıyıdan sancak: öncülük rozeti." },
];

export function MultiPlatformRules() {
  const steps = useMemo(() => STEPS.map((step) => ({ ...step, character: previewNewcomer("kar_tanesi", step.platforms)! })), []);

  return (
    <ol className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
      {steps.map(({ platforms, note, character }, i) => (
        <Fragment key={platforms.length}>
          <li className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-gece-900/70 p-4 text-center">
            <p className="font-display text-lg text-buz-50">
              {platforms.length} platformda takip
            </p>
            <p className="flex items-center gap-1.5" aria-label={platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}>
              {platforms.map((p) => (
                <PlatformIcon key={p} platform={p} className="size-5 text-buz-100" />
              ))}
            </p>
            <CharacterPortrait character={character} size="lg" alt={`${platforms.length} platformda başlayan örnek yoldaş`} />
            <p className={cn("font-display", RARITY_TEXT[character.rarity])}>
              {RARITY_INFO[character.rarity].label} · {character.title}
            </p>
            <BadgeList badges={character.badges} className="justify-center" />
            <p className="text-sm text-buz-300">{note}</p>
          </li>
          {i < steps.length - 1 && (
            <li aria-hidden className="hidden items-center justify-center text-buz-300 md:flex">
              <ChevronRight className="size-6" />
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  );
}
