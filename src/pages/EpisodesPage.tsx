/**
 * BİRİNCİ SEZON ( /bolumler )
 *
 *   giriş            sezonun adı ve Dede Toygar'ın açılış anlatısı
 *   sezon yolculuğu  12 bölüm, 4 perde, ilerleme çubuğu (her durak bölüm kartına götürür)
 *   şimdi oynanıyor  aktif bölüm: süren oylama, akıncılar, boss ve "Akını izle"
 *   bölümler         12 bölüm kartı: oylama sonuçları, akıncılar, bölüm sonu özetleri
 *   boss'lar         sezon ilerledikçe açılan 4 boss kartı
 *
 * Haritadaki üst bant /bolumler#b03-… bağlantısıyla doğrudan ilgili bölüme getirir.
 */
import { useEffect } from "react";
import { useLocation } from "react-router";
import { ActiveEpisodeBanner } from "../components/season/ActiveEpisodeBanner";
import { BossCard } from "../components/season/BossCard";
import { EpisodeCard } from "../components/season/EpisodeCard";
import { NarratorQuote } from "../components/season/NarratorQuote";
import { RaidDialog } from "../components/season/RaidDialog";
import { SeasonTimeline } from "../components/season/SeasonTimeline";
import { SectionTitle } from "../components/ui/SectionTitle";
import { BOSS_LIST } from "../content/bosses";
import { WORLD } from "../content/world";
import { useGameData } from "../data/useGameData";

/** Aktif bölüm bandının kimliği (listedeki aktif kart oylama için buraya bağlanır). */
const BANNER_ID = "simdi";

export default function EpisodesPage() {
  const { episodes, activeEpisode, characterById } = useGameData();
  const { hash } = useLocation();

  // Sayfa tembel yüklendiği için tarayıcı #bölüm bağlantısına kendisi kaydıramaz.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView({ block: "start" });
  }, [hash]);

  const episodeOf = (bossEpisode: number) => episodes[bossEpisode - 1];

  return (
    <>
      <title>Sezon · OBA-Tales</title>
      <meta name="description" content={`${WORLD.season.title}: 12 bölüm, 4 boss akını, oylama sonuçları ve Dede Toygar'ın bölüm özetleri.`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-end">
        <SectionTitle as="h1" eyebrow={`Sezon ${WORLD.season.number}`} title={WORLD.season.title.replace(/^Birinci Sezon: /, "")} description={WORLD.summary} />
        <NarratorQuote className="rounded-2xl border border-white/10 bg-gece-900/70 p-4">
          {WORLD.intro.map((paragraph) => (
            <p key={paragraph} className="mb-2 last:mb-0">
              {paragraph}
            </p>
          ))}
        </NarratorQuote>
      </div>

      <div className="mt-8">
        <SeasonTimeline episodes={episodes} />
      </div>

      {(activeEpisode.status === "aktif" || activeEpisode.status === "yakinda") && (
        <div id={BANNER_ID} className="mt-6 scroll-mt-24">
          <ActiveEpisodeBanner episode={activeEpisode} episodes={episodes} characterById={characterById} />
        </div>
      )}

      <section aria-labelledby="bolumler" className="mt-12">
        <SectionTitle title={<span id="bolumler">Bölümler</span>} description="Her bölümde oba yorumlarla karar verir; kararlar hikâyeyi ve kahramanların nadirliğini değiştirir." />
        <ol className="mt-5 grid gap-4">
          {episodes.map((episode) => (
            <li key={episode.id}>
              <EpisodeCard episode={episode} characterById={characterById} pollsAt={episode.status === "aktif" ? BANNER_ID : undefined} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="bosslar" className="mt-12">
        <SectionTitle
          title={<span id="bosslar">Sezonun boss'ları</span>}
          description="OBA-Tales dünyasında boss'lar yok edilmez: anlaşılır, sakinleşir ve çoğu zaman obanın dostu olur. Kartlar akın günü geldikçe açılır."
        />
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOSS_LIST.map((boss) => {
            const episode = episodeOf(boss.episode);
            return (
              <li key={boss.id} className="flex">
                <BossCard boss={boss} status={episode.status} episodeId={episode.id} />
              </li>
            );
          })}
        </ul>
      </section>

      <RaidDialog />
    </>
  );
}
