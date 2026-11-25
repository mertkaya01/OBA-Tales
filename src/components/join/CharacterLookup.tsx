/**
 * Kahramanını bul — kullanıcı adını yaz:
 *   obadaysan  → kartın, "Kartını aç" ve "Haritada gör"
 *   değilsen   → benzer adlar ve karakter önizlemesi: hangi platformlarda takip ettiğini seç, karakterinin
 *                hangi sınıf, nadirlik ve rozetle başlayacağını gör (ilk seçtiğin platform ana platformun olur)
 *
 * Hiçbir şey gönderilmez ve kaydedilmez: arama yalnızca tarayıcıda, yüklü kadro listesinde yapılır.
 */
import { MapPin, Search } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { CLASSES, PLATFORM_LABELS } from "../../content/classes";
import { RARITY_INFO } from "../../content/rarities";
import { useGameData } from "../../data/useGameData";
import { cn } from "../../lib/cn";
import { isValidHandle, lookupHero, previewNewcomer } from "../../lib/roster";
import { useAppStore } from "../../state/useAppStore";
import { PLATFORMS } from "../../types";
import type { Platform } from "../../types";
import { BadgeList } from "../character/BadgeList";
import { CharacterCard } from "../character/CharacterCard";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { PlatformIcon } from "../character/PlatformIcon";
import { RARITY_TEXT } from "../character/styles";

export function CharacterLookup() {
  const { characters } = useGameData();
  const select = useAppStore((s) => s.select);
  const inputId = useId();
  const [input, setInput] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram"]);
  const query = useDeferredValue(input);
  const result = useMemo(() => lookupHero(characters, query), [characters, query]);
  const preview = useMemo(() => (result.hero ? null : previewNewcomer(result.handle, platforms)), [result, platforms]);
  const typed = result.handle.length >= 2;

  const togglePlatform = (p: Platform) =>
    setPlatforms((list) => (list.includes(p) ? (list.length > 1 ? list.filter((x) => x !== p) : list) : [...list, p]));

  return (
    <div className="rounded-2xl border border-gunozu-400/30 bg-gradient-to-br from-gunozu-400/10 via-gece-900/80 to-gece-900/80 p-5">
      <label htmlFor={inputId} className="font-display text-lg text-buz-50">
        Kullanıcı adın ne?
      </label>
      <div className="relative mt-2">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-buz-300" />
        <input
          id={inputId}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="@kullanici_adi"
          autoComplete="off"
          spellCheck={false}
          maxLength={31}
          className="w-full rounded-xl border border-white/15 bg-gece-950/80 py-2.5 pl-9 pr-3 text-buz-50 placeholder:text-buz-300/60 focus:border-gunozu-400/70"
        />
      </div>
      <p className="mt-1 text-xs text-buz-300">Arama yalnızca bu sayfada yapılır; hiçbir yere gönderilmez.</p>

      <div aria-live="polite" className="mt-4">
        {result.hero && (
          <div className="grid gap-3">
            <p className="font-display text-gunozu-200">Seni bulduk! Obada yerin hazır.</p>
            <CharacterCard character={result.hero} onSelect={select} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => select(result.hero!.id)}
                className="rounded-lg border border-gunozu-400/50 bg-gunozu-400/10 px-3 py-1.5 font-display text-gunozu-200 hover:bg-gunozu-400/20"
              >
                Kartını aç
              </button>
              <Link
                to={`/?k=${encodeURIComponent(result.hero.id)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-buz-100 hover:bg-white/10"
              >
                <MapPin aria-hidden className="size-4" />
                Haritada gör
              </Link>
            </div>
          </div>
        )}

        {!result.hero && typed && (
          <div className="grid gap-4">
            {result.suggestions.length > 0 && (
              <div>
                <p className="text-sm text-buz-200">Bunlardan biri mi?</p>
                <ul className="mt-1 grid gap-1">
                  {result.suggestions.map((c) => (
                    <li key={c.id}>
                      <CharacterCard character={c} onSelect={select} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-gece-950/50 p-4">
              <p className="text-sm text-buz-100">
                <b className="font-semibold">@{result.handle}</b> henüz obada yok. Hangi platformlarda takip ediyorsun ya da edeceksin?
              </p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Takip ettiğin platformlar">
                {PLATFORMS.map((p) => {
                  const order = platforms.indexOf(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={order >= 0}
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        order >= 0 ? "border-gunozu-400 bg-gunozu-400/15 text-gunozu-100" : "border-white/15 text-buz-200 hover:bg-white/5",
                      )}
                    >
                      <PlatformIcon platform={p} className="size-4" />
                      {PLATFORM_LABELS[p]}
                      {order === 0 && <span className="text-[10px] uppercase tracking-wider text-gunozu-300">ana</span>}
                    </button>
                  );
                })}
              </div>

              {preview ? (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <CharacterPortrait character={preview} size="xl" alt={`@${result.handle} için karakter önizlemesi`} />
                  <div className="grid gap-1.5 text-center sm:text-left">
                    <p className="font-display text-2xl text-buz-50">{preview.displayName}</p>
                    <p className={cn("font-display text-lg", RARITY_TEXT[preview.rarity])}>
                      {preview.title} · {RARITY_INFO[preview.rarity].label}
                    </p>
                    <p className="text-sm text-buz-200">
                      {PLATFORM_LABELS[preview.platform]} ana platformun olduğu için <b>{CLASSES[preview.class.id].name}</b> olarak başlarsın:{" "}
                      {CLASSES[preview.class.id].role.toLocaleLowerCase("tr")}
                    </p>
                    <BadgeList badges={preview.badges} className="justify-center sm:justify-start" />
                    <p className="text-xs text-buz-300">
                      Yeni yoldaşlar takımadanın ortasındaki Kutada'da, Kut Kapısı'ndan gelir. Takip ettikten sonra karakterin bir
                      sonraki oba güncellemesinde haritaya eklenir.
                    </p>
                  </div>
                </div>
              ) : (
                !isValidHandle(result.handle) && (
                  <p className="mt-3 text-sm text-kilim-400">Kullanıcı adı 2–30 karakter olmalı; harf, rakam, ".", "_" ve "-" kullanılabilir.</p>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
