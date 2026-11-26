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
    text: "Burası Kutada, OBA-Tales dünyasının kalbi. Bizi takip eden herkes burada bir karakter olarak yaşayacak.",
  },
  {
    id: "kapi",
    target: "kapi",
    title: "Kut Kapısı",
    text: "Yeni gelenler Kut Kapısı'ndan doğar. İlk kahramanlarımız buradan geldi; takip ettiğin gün senin karakterin de buradan adım atar.",
  },
  {
    id: "oba",
    target: "oba",
    title: "Konuk obası",
    text: "Kahramanlar Konuk obasında yaşar: sabah odun keser, gün boyu avlanır, ot toplar; gece ateş başında sohbet eder.",
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
    text: "Adını yazıp kendini bul, ya da henüz aramızda değilsen obaya katıl.",
  },
];

/** Tur bir kez kendiliğinden açılır; görüldüğü tarayıcıda saklanır. Tur değişince sürüm artar, herkes yenisini görür. */
export const TOUR_SEEN_KEY = "oba-tales:tur:v2";
