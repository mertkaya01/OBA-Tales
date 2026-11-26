/**
 * KAHRAMANLARIN SÖZLERİ — aranınca ya da tıklanınca kameraya el sallarken söyledikleri.
 *
 *   · Uyurken (01–05) çadırından uykulu çıkar: WAKE_LINES.
 *   · Uyanıkken o anki işine göre: WORK_LINES[kahraman][iş]; o işe özel söz yoksa GREETINGS.
 *   · Her seferinde sıradaki söz gelir; aynısı art arda çıkmaz.
 *
 * Yeni söz eklemek için listeye bir satır eklemek yeter. Kısa tut: balon iki satırı geçmesin.
 */
import type { Activity } from "../world3d/story/daySchedule";
import type { ArrivalHeroId } from "./story";

export const WAKE_LINES: Readonly<Record<ArrivalHeroId, readonly string[]>> = {
  mhellingtr: ["Uyuyordum… Hoş geldin!", "Yıldızlar daha sönmemiş… Hoş geldin.", "Hı? Sen miydin? İyi geceler, yolcu."],
  egetunce: ["Uyuyordum… Hoş geldin!", "Güneş doğmadan kalkılmaz ki… Hoş geldin.", "Esneyen alp görmedin mi hiç? Hoş geldin!"],
  bintas: ["Uyuyordum… Hoş geldin!", "Köz hâlâ sıcak… Hoş geldin.", "Ocağı sabah ben yakarım, sen dinlen."],
};

export const GREETINGS: Readonly<Record<ArrivalHeroId, readonly string[]>> = {
  mhellingtr: ["Selam yolcu!", "Kutada'ya hoş geldin!", "Yolun yıldızlı olsun!"],
  egetunce: ["Selam!", "Yolun açık olsun!", "Hoş geldin, yoldaş!"],
  bintas: ["Selam!", "Hoş geldin, yolcu!", "Isın biraz, üşümüşsün."],
};

export const WORK_LINES: Readonly<Record<ArrivalHeroId, Partial<Record<Activity, readonly string[]>>>> = {
  mhellingtr: {
    odun: ["Selam! Odun bitmez buralarda.", "Okçu da balta tutar, gördün mü?"],
    tasima: ["Bu bağ da istife! Selam!", "Sırtım odun, gönlüm şen. Hoş geldin!"],
    toplama: ["Böğürtlenler bu yıl pek tatlı!", "Bir avuç da sana ayırdım."],
    av: ["Şşş… geyik kaçmasın!", "Rüzgâr bizden yana. Selam!", "Yıldızlar yolu gösterir, ok da izi."],
    ates: ["Gel, ateşin başına otur!", "Bu gece gökyüzü pek berrak."],
    sabah: ["Günaydın! Dere buz gibi.", "Yeni bir gün, yeni bir iz."],
    uyanis: ["Günaydın… Erkencisin!"],
  },
  egetunce: {
    odun: ["Selam! Odun bitmez buralarda.", "Bir vuruş daha, devrilecek!", "Kılıç dinleniyor, balta çalışıyor."],
    toplama: ["Lavanta buldum, kokla bak!", "Şifalı otlar BinTaş'a."],
    iz: ["Bak, taze bir iz!", "Geyik buradan geçmiş."],
    ates: ["Ateş harlı, sohbet tatlı!", "Dede bir hikâye daha anlatsa…"],
    sabah: ["Günaydın! Güneş benden önce kalkmış.", "Dere suyu adamı uyandırır!"],
    uyanis: ["Günaydın… Gerinmeden olmaz!"],
  },
  bintas: {
    su: ["Kazan kaynamadan su bitmesin!", "Dere suyu, ocak ateşi. Selam!"],
    toplama: ["Bu ot üşüyene iyi gelir.", "Biraz da kekik, çorbaya."],
    kurutma: ["Otlar kurusun, kışa şifa olsun.", "Kışa şifa biriktiriyorum."],
    ates: ["Ateşim sönmez, merak etme!", "Isın biraz, yolcu."],
    sabah: ["Ocak yandı, çorba geliyor!", "Günaydın! Köz hâlâ canlı."],
    uyanis: ["Günaydın… Ocak beni bekler."],
  },
};

/** Kahramanın bu tepkideki sözü. n: bu kahramanın kaçıncı tepkisi (sırayla döner). */
export function pickLine(hero: ArrivalHeroId, activity: Activity, asleep: boolean, n: number): string {
  const list = asleep ? WAKE_LINES[hero] : (WORK_LINES[hero][activity] ?? GREETINGS[hero]);
  return list[((n % list.length) + list.length) % list.length];
}
