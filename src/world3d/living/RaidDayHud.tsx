/**
 * Akın Günü göstergesi — izleme modunda 3D sahnenin üstünde: boss'un Öfke çubuğu, perde başlığı ve yoldaşların adı
 * geçen anlık haberler ("@ayaz_kiz çekirdeği vurdu!"). Zaman 3D döngüsünden (BattleRuntime.day) okunur.
 */
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import type { Character, ClassId } from "../../types";
import type { BattleRuntime } from "./raid";
import { actAt, fillAct, rageAt, raidCallouts } from "./raidDay";

const CLASS_TEXT: Readonly<Record<ClassId, string>> = {
  kalkaneri: "text-kalkaneri",
  okyeli: "text-okyeli",
  ocakcan: "text-ocakcan",
};

interface RaidDayHudProps {
  battle: BattleRuntime;
  bossName: string;
  raiders: readonly Character[];
  /** Akın sonunda kazanılan rozetin adı (varsa). */
  badge: string | null;
}

export function RaidDayHud({ battle, bossName, raiders, badge }: RaidDayHudProps) {
  const [clock, setClock] = useState({ t: 0, loop: 0 });
  useEffect(() => {
    const timer = window.setInterval(() => {
      const day = battle.day;
      if (day) setClock({ t: day.t, loop: day.loop });
    }, 120);
    return () => window.clearInterval(timer);
  }, [battle]);

  const callouts = useMemo(() => raidCallouts(raiders, clock.loop), [raiders, clock.loop]);
  const { act } = actAt(clock.t);
  const rage = rageAt(clock.t);
  const recent = callouts.filter((c) => c.at <= clock.t && clock.t - c.at < 4.5).slice(-3);
  const caption = fillAct(act.caption, bossName, raiders.length) + (act.id === "zafer" && badge ? ` Rozet: ${badge}.` : "");

  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-28 z-10 w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-gece-900/80 px-3 py-2 shadow-lg backdrop-blur sm:top-24" aria-hidden>
        <div className="flex items-baseline justify-between text-xs text-buz-200">
          <span className="font-display text-sm text-buz-50">{bossName}</span>
          <span className={rage > 0 ? "text-alev-400" : "text-gunozu-200"}>{rage > 0 ? `Öfke ${rage}` : "Sakin"}</span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-white/25 bg-black/55">
          <div className="h-full rounded-full bg-linear-to-r from-alev-500 via-alev-400 to-gunozu-300 transition-[width] duration-300" style={{ width: `${rage}%` }} />
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-36 left-3 right-16 z-10 rounded-2xl border border-white/10 bg-gece-900/75 px-4 py-2.5 text-center shadow-xl backdrop-blur sm:bottom-20 sm:left-1/2 sm:right-auto sm:w-[min(70vw,34rem)] sm:-translate-x-1/2 sm:px-5 sm:py-3"
        role="status"
        aria-live="polite"
      >
        <p key={act.id} className="font-display text-2xl text-gunozu-200 sm:text-3xl drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] motion-safe:animate-[pulse_1.2s_ease-out_1]">
          {fillAct(act.title, bossName, raiders.length)}
        </p>
        <p className="mt-1 text-sm text-buz-50">{caption}</p>
      </div>

      <ul className="pointer-events-none absolute right-3 top-1/3 z-10 max-w-[70vw] space-y-1.5 sm:right-4" aria-hidden>
        {recent.map((c) => (
          <li key={`${clock.loop}:${c.at}`} className="rounded-lg border border-white/15 bg-gece-900/85 px-3 py-1.5 text-sm shadow-lg backdrop-blur">
            <span className={cn("font-semibold", c.cls ? CLASS_TEXT[c.cls] : "text-gunozu-200")}>{c.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
