/**
 * İLK OBA TURU — siteye ilk gelen yoldaşı Dede Toygar karşılar; kamera adalar, Kut Kapısı, bir oba ve akın meydanı
 * arasında uçar. Sonunda "kendini bul" ya da "obaya katıl" çağrısı. Saf veri: kamera hedefi türleri WelcomeTour.tsx'te
 * dünyadaki yerlere çevrilir.
 */
export type TourTarget = "adalar" | "kapi" | "oba" | "meydan" | "arama";

export interface TourStep {
  id: string;
  target: TourTarget;
  title: string;
  /** {boss} yerine aktif bölümün boss'u gelir. */
  text: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "hosgeldin",
    target: "adalar",
    title: "Hoş geldin yoldaş!",
    text: "Burası Ayazlı Adalar, OBA-Tales dünyası. Bizi takip eden herkes burada bir karakter olarak yaşar.",
  },
  {
    id: "kapi",
    target: "kapi",
    title: "Kut Kapısı",
    text: "Yeni gelenler Kut Kapısı'ndan doğar. Takip ettiğin gün senin karakterin de buradan adım atar.",
  },
  {
    id: "oba",
    target: "oba",
    title: "Obalar",
    text: "Sonra bir obaya yerleşirsin. Instagram'dan gelen Kalkaneri, TikTok'tan gelen Okyeli, YouTube'dan gelen Ocakcan olur.",
  },
  {
    id: "akin",
    target: "meydan",
    title: "Akın günü",
    text: "Her bölüm bir akın! Bu hafta {boss} yolu kesti. Oba omuz omuza onu sakinleştirecek; kimse yaralanmaz.",
  },
  {
    id: "sen",
    target: "arama",
    title: "Sıra sende",
    text: "Adını yazıp kendini bul, ya da henüz aramızda değilsen obaya katıl.",
  },
];

/** Turun bu sefer gösterilecek adımları: aktif akın yoksa meydan adımı atlanır. */
export function tourSteps(boss: string | null): TourStep[] {
  return TOUR_STEPS.filter((step) => step.target !== "meydan" || boss !== null).map((step) => ({ ...step, text: step.text.replaceAll("{boss}", boss ?? "") }));
}

/** Tur bir kez kendiliğinden açılır; görüldüğü tarayıcıda saklanır. */
export const TOUR_SEEN_KEY = "oba-tales:tur:v1";
