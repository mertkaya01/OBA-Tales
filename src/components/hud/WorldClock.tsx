/**
 * Adalar saati (sağ alt): gün evresi, saat, sezonun kaçıncı günü ve hava.
 * Tıklanınca "hızlı zaman" açılır: bir gün iki dakikada geçer (gün batımını, geceyi görmek için).
 */
import { CloudSnow, FastForward, Moon, Snowflake, Sun, Sunrise, Sunset } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";
import { readWorldHour, useWorldTime } from "../../state/useWorldTime";
import type { Weather } from "../../types";
import { DAY_PHASES, dayPhase, formatHour, seasonDay, type DayPhaseId } from "../../world3d/living/sky";

const PHASE_ICON: Record<DayPhaseId, typeof Sun> = {
  safak: Sunrise,
  sabah: Sun,
  ogle: Sun,
  ikindi: Sun,
  aksam: Sunset,
  gece: Moon,
};

const WEATHER_LABEL: Record<Weather, string | null> = { acik: null, kar: "Kar", tipi: "Tipi" };

interface WorldClockProps {
  /** Sezonun ilk bölümünün yayın tarihi (gün sayacı için). */
  seasonStart: string | null;
  weather: Weather;
}

export function WorldClock({ seasonStart, weather }: WorldClockProps) {
  const lapse = useWorldTime((s) => s.settings.lapse !== null);
  const toggle = useWorldTime((s) => s.toggleTimeLapse);
  const drawerOpen = useAppStore((s) => s.selectedId !== null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), lapse ? 250 : 15_000);
    return () => window.clearInterval(timer);
  }, [lapse]);

  const hour = readWorldHour(now);
  const phase = dayPhase(hour);
  const Icon = PHASE_ICON[phase];
  const day = seasonDay(seasonStart, now);
  const weatherLabel = WEATHER_LABEL[weather];
  const WeatherIcon = weather === "tipi" ? CloudSnow : Snowflake;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={lapse}
      title={lapse ? "Hızlı zamanı kapat" : "Hızlı zaman: bir gün iki dakikada geçsin"}
      aria-label={`Adalar saati: ${DAY_PHASES[phase]} ${formatHour(hour)}. ${lapse ? "Hızlı zamanı kapat" : "Hızlı zamanı aç"}`}
      className={cn(
        "absolute bottom-4 right-16 z-10 flex items-center gap-2 rounded-xl border border-white/15 bg-gece-900/90 px-3 py-1.5 text-left shadow-lg backdrop-blur transition-colors hover:bg-gece-800/95",
        lapse && "border-gunozu-400/70",
        drawerOpen && "md:right-[464px]",
      )}
    >
      <Icon aria-hidden className={cn("size-5 shrink-0", phase === "gece" ? "text-buz-200" : "text-gunozu-400")} />
      <span className="grid leading-tight">
        <span className="font-display text-sm text-buz-50">
          {DAY_PHASES[phase]} <span className="tabular-nums text-buz-200">{formatHour(hour)}</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-buz-200">
          {day !== null && <span>Gün {day}</span>}
          {weatherLabel && (
            <>
              {day !== null && <span aria-hidden>·</span>}
              <WeatherIcon aria-hidden className="size-3" />
              {weatherLabel}
            </>
          )}
        </span>
      </span>
      {lapse && <FastForward aria-hidden className="size-4 text-gunozu-400" />}
    </button>
  );
}
