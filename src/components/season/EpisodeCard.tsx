/**
 * Bölüm kartı — başlık, bölge, durum, özet, oylamalar, akıncılar ve Dede Toygar'ın bölüm sonu özeti.
 * Kilitli bölümler gizemli kalır: yalnızca numarası, bölgesi ve "sis henüz dağılmadı" görünür.
 */
import { CalendarDays, Lock, MapPin, Swords, Users } from "lucide-react";
import { useMemo } from "react";
import { BOSSES } from "../../content/bosses";
import { EPISODE_STATUS_LABELS } from "../../content/episodes";
import { REGIONS } from "../../content/regions";
import type { EpisodeView } from "../../data/loaders";
import { cn } from "../../lib/cn";
import { pollStandings } from "../../lib/season";
import { formatDate, formatNumber } from "../../lib/text";
import type { Character, EpisodeStatus } from "../../types";
import { Badge, type BadgeTone } from "../ui/Badge";
import { NarratorQuote } from "./NarratorQuote";
import { RaidersStack } from "./RaidersStack";
import { VotePoll } from "./VotePoll";

const STATUS_TONE: Readonly<Record<EpisodeStatus, BadgeTone>> = {
  kilitli: "neutral",
  yakinda: "ice",
  aktif: "red",
  tamamlandi: "gold",
};

interface EpisodeCardProps {
  episode: EpisodeView;
  characterById: ReadonlyMap<string, Character>;
  /** Oylamalar sayfanın başka bir yerinde gösteriliyorsa oranın kimliği (ör. aktif bölüm bandı). */
  pollsAt?: string;
}

export function EpisodeCard({ episode, characterById, pollsAt }: EpisodeCardProps) {
  const locked = episode.status === "kilitli";
  const boss = episode.bossId ? BOSSES[episode.bossId] : null;
  const progress = episode.progress;
  const raiders = useMemo(
    () => (progress?.participantIds ?? []).map((id) => characterById.get(id)).filter((c): c is Character => !!c),
    [progress, characterById],
  );
  const standings = useMemo(
    () => episode.polls.map((poll) => pollStandings(poll, progress?.results.find((r) => r.pollId === poll.id))),
    [episode.polls, progress],
  );
  const showPolls = episode.status === "aktif" || episode.status === "tamamlandi";

  return (
    <article
      id={episode.id}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-gece-900/70 p-4 sm:p-5",
        episode.status === "aktif" ? "border-alev-400/50" : "border-white/10",
        locked && "bg-gece-900/40",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-buz-300">
            <span className="font-display text-buz-100">Bölüm {episode.number}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {REGIONS[episode.region].name}
            </span>
            {progress?.airedAt && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden className="size-3.5" />
                {formatDate(progress.airedAt)}
              </span>
            )}
          </p>
          <h3 className={cn("font-display text-2xl", locked ? "text-buz-300" : "text-buz-50")}>{locked ? "Sisin ardındaki bölüm" : episode.title}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {boss && !locked && (
            <Badge tone="red" icon={<Swords aria-hidden className="size-3" />}>
              Boss: {boss.name}
            </Badge>
          )}
          <Badge tone={STATUS_TONE[episode.status]} icon={locked ? <Lock aria-hidden className="size-3" /> : undefined}>
            {EPISODE_STATUS_LABELS[episode.status]}
          </Badge>
        </div>
      </header>

      {locked ? (
        <p className="mt-2 text-sm text-buz-300">
          Sis henüz dağılmadı. Oba {REGIONS[episode.region].name} kıyılarına vardığında bu bölümün hikâyesi açılacak.
        </p>
      ) : (
        <p className="mt-2 text-buz-200">{episode.summary}</p>
      )}

      {showPolls && pollsAt && standings.length > 0 && (
        <a href={`#${pollsAt}`} className="mt-3 inline-block text-sm text-zumrut-300 underline-offset-4 hover:underline">
          Oylama sürüyor: sonuçlar yukarıda ↑
        </a>
      )}
      {showPolls && !pollsAt && standings.length > 0 && (
        <div className={cn("mt-4 grid gap-3", standings.length > 1 && "lg:grid-cols-2")}>
          {standings.map((s) => (
            <VotePoll key={s.poll.id} standing={s} />
          ))}
        </div>
      )}
      {episode.status === "yakinda" && episode.polls.length > 0 && (
        <p className="mt-3 text-sm text-buz-300">
          Bu bölümde {episode.polls.length === 1 ? "bir" : "iki"} oylama var: <span className="text-buz-100">{episode.polls.map((p) => p.question).join(" · ")}</span>
        </p>
      )}

      {raiders.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-buz-200">
            <Users aria-hidden className="size-4" />
            <b className="font-display tabular-nums text-buz-50">{formatNumber(raiders.length)}</b> akıncı
          </span>
          <RaidersStack raiders={raiders} />
        </div>
      )}

      {progress?.recap && (
        <NarratorQuote compact className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {progress.recap}
        </NarratorQuote>
      )}
    </article>
  );
}
