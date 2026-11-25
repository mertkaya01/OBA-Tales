/**
 * Sezon çizelgesi — 12 bölüm, 4 perde; her perde bir boss akınıyla kapanır.
 * Her durak bölüm kartına götürür. Üstte sezonun ne kadarının geçtiğini gösteren çubuk.
 */
import { Check, Lock, Swords } from "lucide-react";
import { BOSSES } from "../../content/bosses";
import type { EpisodeView } from "../../data/loaders";
import { cn } from "../../lib/cn";
import { seasonActs, seasonProgress } from "../../lib/season";

const NODE: Record<EpisodeView["status"], string> = {
  tamamlandi: "border-gunozu-400 bg-gunozu-400 text-gece-950",
  aktif: "border-alev-400 bg-alev-400/20 text-alev-300 ring-4 ring-alev-400/25 motion-safe:animate-pulse",
  yakinda: "border-buz-300 bg-gece-800 text-buz-100",
  kilitli: "border-white/20 bg-gece-900 text-buz-300/70",
};

export function SeasonTimeline({ episodes }: { episodes: readonly EpisodeView[] }) {
  const progress = seasonProgress(episodes);
  const acts = seasonActs(episodes);

  return (
    <nav aria-label="Sezon çizelgesi" className="rounded-2xl border border-white/10 bg-gece-900/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-buz-50">Sezon yolculuğu</h2>
        <p className="text-sm text-buz-300">
          {progress.completed} / {progress.total} bölüm tamamlandı{progress.active ? ` · Bölüm ${progress.active} sürüyor` : ""}
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Sezonun ilerlemesi"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-gunozu-500 to-alev-400" style={{ width: `${progress.percent}%` }} />
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {acts.map((act) => (
          <li key={act.number} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-widest text-buz-300">
              {/* Boss'un adı, kendi bölümü kilitliyken gizli kalır (boss kartıyla aynı kural). */}
              {act.number}. Perde{act.bossId && act.episodes[act.episodes.length - 1].status !== "kilitli" ? ` · ${BOSSES[act.bossId].name}` : ""}
            </p>
            <ol className="mt-2 flex items-center">
              {act.episodes.map((ep, i) => (
                <li key={ep.id} className="flex flex-1 items-center last:flex-none">
                  <a
                    href={`#${ep.id}`}
                    title={`Bölüm ${ep.number}${ep.status === "kilitli" ? "" : ` · ${ep.title}`}`}
                    aria-label={`Bölüm ${ep.number}${ep.status === "kilitli" ? ", kilitli" : `: ${ep.title}`}${ep.bossId ? ", boss akını" : ""}`}
                    aria-current={ep.status === "aktif" ? "step" : undefined}
                    className={cn(
                      "relative grid size-10 shrink-0 place-items-center rounded-full border-2 font-display text-sm transition-transform hover:scale-110",
                      NODE[ep.status],
                      ep.bossId && "rounded-lg rotate-45",
                    )}
                  >
                    <span className={cn("grid place-items-center", ep.bossId && "-rotate-45")}>
                      {ep.status === "tamamlandi" ? (
                        <Check aria-hidden className="size-4" />
                      ) : ep.status === "kilitli" ? (
                        <Lock aria-hidden className="size-3.5" />
                      ) : ep.bossId ? (
                        <Swords aria-hidden className="size-4" />
                      ) : (
                        ep.number
                      )}
                    </span>
                  </a>
                  {i < act.episodes.length - 1 && (
                    <span aria-hidden className={cn("mx-1 h-0.5 flex-1 rounded-full", ep.status === "tamamlandi" ? "bg-gunozu-400/70" : "bg-white/15")} />
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}
