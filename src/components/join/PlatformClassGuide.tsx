/**
 * Platform → sınıf rehberi: Instagram'dan gelen Kalkaneri, TikTok'tan gelen Okyeli, YouTube'dan gelen Ocakcan.
 * Her sütunda örnek bir başlangıç karakteri, görünüşü, yetenekleri ve takip bağlantısı.
 */
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { CLASS_LIST } from "../../content/classes";
import { previewNewcomer } from "../../lib/roster";
import type { Platform, SocialLinks } from "../../types";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { PlatformIcon } from "../character/PlatformIcon";

const SAMPLE_HANDLES = { instagram: "ornek_kalkan", tiktok: "ornek_yay", youtube: "ornek_ocak" } as const;

/** Türkçe ek uyumu: Instagram'dan / TikTok'tan / YouTube'dan · Instagram'da / TikTok'ta / YouTube'da. */
const SUFFIX: Readonly<Record<Platform, { from: string; at: string }>> = {
  instagram: { from: "'dan", at: "'da" },
  tiktok: { from: "'tan", at: "'ta" },
  youtube: { from: "'dan", at: "'da" },
};

/** "Kalkan Duvarı: kalkanlar yan yana dizilir…" → ad ve açıklama. */
function splitAbility(text: string): [string, string] {
  const i = text.indexOf(":");
  return i < 0 ? [text, ""] : [text.slice(0, i), text.slice(i + 1).trim()];
}

export function PlatformClassGuide({ socialLinks }: { socialLinks: SocialLinks }) {
  const samples = useMemo(() => Object.fromEntries(CLASS_LIST.map((cls) => [cls.id, previewNewcomer(SAMPLE_HANDLES[cls.platform], [cls.platform])!])), []);

  return (
    <ul className="grid gap-4 lg:grid-cols-3">
      {CLASS_LIST.map((cls) => {
        const link = socialLinks[cls.platform];
        return (
          <li key={cls.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gece-900/70 p-5">
            <p className="flex items-center gap-2 text-sm text-buz-200">
              <PlatformIcon platform={cls.platform} className="size-5" />
              {cls.platformLabel}
              {SUFFIX[cls.platform].from} gelenler
            </p>
            <div className="flex items-center gap-4">
              <CharacterPortrait character={samples[cls.id]} size="lg" alt={`Örnek ${cls.name}`} />
              <div>
                <h3 className="font-display text-2xl text-buz-50">{cls.name}</h3>
                <p className="text-sm text-gunozu-200">{cls.archetypeLabel}</p>
                <p className="mt-1 text-sm text-buz-200">{cls.role}</p>
              </div>
            </div>
            <p className="text-sm text-buz-300">{cls.description}</p>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-buz-300">Görünüş</h4>
              <p className="mt-1 text-sm text-buz-200">{cls.appearance.join(" · ")}</p>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-buz-300">Yetenekler</h4>
              <ul className="mt-1 grid gap-1.5">
                {cls.abilities.map((ability) => {
                  const [name, text] = splitAbility(ability);
                  return (
                    <li key={name} className="text-sm text-buz-200">
                      <b className="font-semibold text-buz-50">{name}</b>
                      {text && `: ${text}`}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-auto pt-1">
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gunozu-400/50 bg-gunozu-400/10 px-3 py-1.5 font-display text-gunozu-200 hover:bg-gunozu-400/20"
                >
                  {cls.platformLabel}
                  {SUFFIX[cls.platform].at} takip et
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-buz-300">
                  {cls.platformLabel} bağlantısı yakında
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
