/**
 * İLK OBA TURU — siteye ilk gelen yoldaşı Dede Toygar karşılar (haritada değil, sesiyle); kamera Kutada, Kut Kapısı,
 * Konuk obası ve karartılı adalar arasında uçar. Sonunda "kendini bul" ya da "obaya katıl" çağrısı. Saf veri: kamera
 * hedefi türleri WelcomeTour.tsx'te dünyadaki yerlere çevrilir.
 */
export type TourTarget = "adalar" | "kapi" | "oba" | "gizli" | "arama";

export interface TourStep {
  id: string;
  target: TourTarget;
  title: string;
  text: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "hosgeldin",
    target: "adalar",
    title: "Hoş geldin yoldaş!",
    text: "Ben Dede Toygar. Burası Kutada, OBA-Tales dünyasının kalbi. Bizi takip eden herkes bu adada bir karakter olarak doğar ve yaşar.",
  },
  {
    id: "kapi",
    target: "kapi",
    title: "Kut Kapısı",
    text: "Gökle yeri bağlayan kapı bu. Takip ettiğin gün senin karakterin de buradan, bir ışık küresinin içinde adım atar.",
  },
  {
    id: "kahramanlar",
    target: "oba",
    title: "İlk üç kahraman",
    text: "Kapıdan ilk geçenler onlar oldu: Yıldızların Okçusu mhellingtr, Gün Kılıçlı Alp egetunce ve Alev Hatun BinTaş. Birine dokun, yeteneğini gör.",
  },
  {
    id: "oba",
    target: "oba",
    title: "Konuk obası",
    text: "Kahramanlar Konuk obasında yaşar: sabah odun keser, gün boyu avlanır, ot toplar; gece ateş başında sohbet eder. Saatleri İstanbul saatidir.",
  },
  {
    id: "gizli",
    target: "gizli",
    title: "Karanlıktaki adalar",
    text: "Çevredeki adalar henüz karanlıkta. Sizlerin desteğiyle, hikâye ilerledikçe birer birer aydınlanacaklar.",
  },
  {
    id: "sen",
    target: "arama",
    title: "Sıra sende",
    text: "Bizi takip ediyorsan kullanıcı adını yaz, karakterini bul. Henüz haritada yoksan takip et: karakterin Kut Kapısı'ndan doğsun.",
  },
];

/** Tur bir kez kendiliğinden açılır; görüldüğü tarayıcıda saklanır. Tur değişince sürüm artar, herkes yenisini görür. */
export const TOUR_SEEN_KEY = "oba-tales:tur:v2";
