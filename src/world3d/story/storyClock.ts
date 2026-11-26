/**
 * HİKÂYE SAATİ — kahramanların gün düzeni hangi gün, günün kaçıncı saniyesinde?
 *
 *   · Gerçek zamanda İstanbul saati, milisaniye hassasiyetiyle: herkes aynı anda aynı şeyi görür.
 *   · ?saat=9 ile sabitlenen saatte gökyüzü sabit kalır ama kahramanlar o saatten itibaren gerçek hızda yaşar
 *     (yoksa yürürken yerinde donarlar).
 *   · Hızlı zamanda (bir gün 2 dakika) gün düzeni de hızlanır.
 *
 * Saf fonksiyonlardır; yalnızca İstanbul'un UTC farkı dakikada bir Intl ile ölçülür.
 */
import { TIME_LAPSE_DAY_MS, worldHour, type WorldTimeSettings } from "../living/sky";

export const DAY_SECONDS = 86_400;

export interface StoryTime {
  /** Takvim günü (İstanbul, 1970'ten beri). Günlük çeşitlilik bundan seçilir. */
  day: number;
  /** Günün saniyesi (0–86400). */
  seconds: number;
}

const offsetCache = { at: Number.NEGATIVE_INFINITY, offset: 0 };

/** İstanbul'un UTC'den farkı (saniye). Dakikada bir yeniden ölçülür. */
export function istanbulOffset(nowMs: number): number {
  if (Math.abs(nowMs - offsetCache.at) > 60_000) {
    const local = worldHour(new Date(nowMs)) * 3600;
    const utc = (((nowMs / 1000) % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
    let offset = Math.round((local - utc) / 900) * 900;
    if (offset > DAY_SECONDS / 2) offset -= DAY_SECONDS;
    if (offset < -DAY_SECONDS / 2) offset += DAY_SECONDS;
    offsetCache.at = nowMs;
    offsetCache.offset = offset;
  }
  return offsetCache.offset;
}

function split(absoluteSeconds: number): StoryTime {
  const day = Math.floor(absoluteSeconds / DAY_SECONDS);
  return { day, seconds: absoluteSeconds - day * DAY_SECONDS };
}

/**
 * Şu anki hikâye zamanı.
 * @param elapsed sahne açıldığından beri geçen saniye (dünya saati): ?saat= ile sabitlenince oradan ilerler.
 */
export function storyTime(settings: WorldTimeSettings, nowMs: number, elapsed: number): StoryTime {
  if (settings.lapse) {
    const { startedAt, startHour } = settings.lapse;
    const startDay = Math.floor((startedAt / 1000 + istanbulOffset(startedAt)) / DAY_SECONDS);
    return split(startDay * DAY_SECONDS + startHour * 3600 + ((nowMs - startedAt) / TIME_LAPSE_DAY_MS) * DAY_SECONDS);
  }
  const absolute = nowMs / 1000 + istanbulOffset(nowMs);
  if (settings.override !== null) {
    const today = Math.floor(absolute / DAY_SECONDS);
    return split(today * DAY_SECONDS + settings.override * 3600 + elapsed);
  }
  return split(absolute);
}

/** "07:30" gibi bir saati günün saniyesine çevirir. */
export const at = (hour: number, minute = 0) => hour * 3600 + minute * 60;
