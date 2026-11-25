/**
 * Aktif bölüm bandı — "Şimdi oynanıyor": bölümün özeti, süren oylama, akıncılar, boss ve sıradaki bölümün zamanı.
 */
import { CalendarClock, Map as MapIcon, Swords } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { BOSSES } from "../../content/bosses";
import { REGIONS } from "../../content/regions";
import type { EpisodeView } from "../../data/loaders";
import { nextAirTime, pollStandings } from "../../lib/season";
import { formatAirTime, formatNumber } from "../../lib/text";
import { useAppStore } from "../../state/useAppStore";
import type { Character } from "../../types";
import { RaidersStack } from "./RaidersStack";
import { bossImageUrl } from "./seasonArt";
import { VotePoll } from "./VotePoll";

interface ActiveEpisodeBannerProps {
  episode: EpisodeView;
  episodes: readonly EpisodeView[];
  characterById: ReadonlyMap<string, Character>;
}

export function ActiveEpisodeBanner({ episode, episodes, characterById }: ActiveEpisodeBannerProps) {
  const setRaidOpen = useAppStore((s) => s.setRaidOpen);
  const boss = episode.bossId ? BOSSES[episode.bossId] : null;
  const next = nextAirTime(episodes);
  const raiders = useMemo(
    () => (episode.progress?.participantIds ?? []).map((id) => characterById.get(id)).filter((c): c is Character => !!c),
    [episode.progress, characterById],
  );
  const standings = episode.polls.map((poll) => pollStandings(poll, episode.progress?.results.find((r) => r.pollId === poll.id)));
  const active = episode.status === "aktif";

  return (
    <section aria-labelledby="aktif-bolum" className="overflow-hidden rounded-2xl border border-alev-400/40 bg-gradient-to-br from-alev-500/10 via-gece-900/80 to-gece-900/80">
      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-alev-300">
            {active ? "Şimdi oynanıyor" : "Sıradaki bölüm"} · Bölüm {episode.number} · {REGIONS[episode.region].name}
          </p>
          <h2 id="aktif-bolum" className="mt-1 text-3xl text-gunozu-300">
            {episode.title}
          </h2>
          <p className="mt-2 max-w-2xl text-buz-100">{episode.summary}</p>

          {active && standings.length > 0 && (
            <div className="mt-4 grid gap-3">
              {standings.map((s) => (
                <VotePoll key={s.poll.id} standing={s} />
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            {raiders.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-buz-200">
                  <b className="font-display tabular-nums text-buz-50">{formatNumber(raiders.length)}</b> akıncı yolda
                </span>
                <RaidersStack raiders={raiders} max={8} />
              </div>
            )}
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-buz-100 underline-offset-4 hover:underline">
              <MapIcon aria-hidden className="size-4" />
              Haritada gör
            </Link>
          </div>

          {next && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-buz-200">
              <CalendarClock aria-hidden className="size-4" />
              Bölüm {next.number}: <span className="text-buz-50">{formatAirTime(next.iso)}</span> (tahmini)
            </p>
          )}
        </div>

        {boss && (
          <div className="flex flex-col items-center justify-end gap-3 rounded-xl border border-white/10 bg-gece-950/60 p-4 text-center">
            <img src={bossImageUrl(boss.id, active ? "tam" : "siluet")} alt={`${boss.name} piksel resmi`} className="pixelated h-36 w-auto" />
            <div>
              <p className="font-display text-xl text-buz-50">{boss.name}</p>
              <p className="text-sm text-gunozu-200">{boss.epithet}</p>
            </div>
            {active && (
              <button
                type="button"
                onClick={() => setRaidOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-alev-400/50 bg-alev-400/15 px-3 py-2 font-display text-alev-300 hover:bg-alev-400/25"
              >
                <Swords aria-hidden className="size-4" />
                Akını izle ve prova yap
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
