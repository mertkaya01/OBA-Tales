/**
 * Oylama sonucu: soru, seçenekler ve oy çubukları.
 *   Biten oylama  → kazanan altın çerçeve ve taç simgesiyle
 *   Süren oylama  → önde giden buz mavisi; altta nasıl oy verileceği yazar
 */
import { Crown, MessageCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { voteHint, type PollStanding } from "../../lib/season";
import { formatNumber } from "../../lib/text";

export function VotePoll({ standing, className }: { standing: PollStanding; className?: string }) {
  const { poll, total, closed, options } = standing;

  return (
    <figure className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-3", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold text-buz-50">{poll.question}</span>
        <span className={cn("text-xs", closed ? "text-buz-300" : "text-zumrut-300")}>
          {closed ? "Sonuçlandı" : "Oylama sürüyor"} · {formatNumber(total)} oy
        </span>
      </figcaption>

      <ul className="mt-3 grid gap-2">
        {options.map((o) => (
          <li
            key={o.id}
            className={cn(
              "relative overflow-hidden rounded-lg border px-3 py-2",
              o.winner ? "border-gunozu-400/70" : o.leading ? "border-buz-400/50" : "border-white/10",
            )}
          >
            {/* Oy çubuğu: arka planı yüzdesi kadar doldurur */}
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0", o.winner ? "bg-gunozu-400/20" : o.leading ? "bg-buz-400/15" : "bg-white/[0.06]")}
              style={{ width: `${o.percent}%` }}
            />
            <span className="relative flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className={cn("flex items-center gap-1.5 font-display", o.winner ? "text-gunozu-200" : "text-buz-50")}>
                  {o.winner && <Crown aria-label="Kazanan" className="size-4 shrink-0 text-gunozu-300" />}
                  {o.label}
                </span>
                {o.description && <span className="block text-xs text-buz-300">{o.description}</span>}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className={cn("font-display text-lg", o.winner ? "text-gunozu-200" : "text-buz-100")}>%{o.percent}</span>
                <span className="block text-[11px] text-buz-300">{formatNumber(o.votes)} oy</span>
              </span>
            </span>
          </li>
        ))}
      </ul>

      {!closed && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-buz-300">
          <MessageCircle aria-hidden className="size-3.5" />
          Oy ver: bölümün paylaşımında {voteHint(options.map((o) => o.label))}.
        </p>
      )}
    </figure>
  );
}
