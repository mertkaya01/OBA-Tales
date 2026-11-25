/**
 * BOSS'LAR — her üç bölümde bir akın.
 * OBA-Tales dünyasında boss'lar yok edilmez: anlaşılır, sakinleşir ve çoğu zaman obanın dostu olur.
 */
import { BOSS_IDS } from "../types";
import type { Boss, BossId, Catalog } from "../types";

export const BOSSES: Catalog<BossId, Boss> = {
  buzkiran_tekgoz: {
    id: "buzkiran_tekgoz",
    name: "Buzkıran Tekgöz",
    epithet: "Buzulların Şaşkın Devi",
    episode: 3,
    region: "ayazbogazi",
    element: "buz",
    description:
      "Buzullardan süzülerek inen, tek kocaman gözüyle her şeye şaşkın şaşkın bakan hantal bir dev. " +
      "Geçitten geçmek isteyenlerin önüne buz kütleleri yuvarlar; aslında kimseye kötülük istemez, " +
      "yalnızca yankılanan gürültülerden ürkmüştür.",
    weakness:
      "Göğsündeki mavi buz çekirdeği. Ocak ateşinin sıcaklığı ve sakin bir ninni çekirdeği yavaşça eritir.",
    resolution:
      "Çekirdeği eriyince Tekgöz uysallaşır, geçidin bekçisi olur ve obaya buz kütlelerinden sağlam bir köprü kurar.",
  },
  sisci_karacay: {
    id: "sisci_karacay",
    name: "Sisçi Karaçay",
    epithet: "Pusların Kurnaz Gölge Gemisi",
    episode: 6,
    region: "pusluada",
    element: "sis",
    description:
      "Yelkenleri dumandan dokunmuş, kendi kendine süzülen kurnaz bir gölge gemisi. Koyları koyu sisle sarar, " +
      "pusulaların ibresini fırıl fırıl döndürür, fenerlerin ışığını yutar.",
    weakness: "Işık zinciri ve ortak ritim. Birbirine seslenen, birbirini gören bir oba sisin içinde kaybolmaz.",
    resolution:
      "Fener zinciri ve oba davulu sisi dağıtınca Karaçay'ın aslında yolunu kaybetmiş eski bir keşif teknesi " +
      "olduğu anlaşılır; obaya Pusluada'nın gizli limanını gösterir.",
  },
  ayazkurt: {
    id: "ayazkurt",
    name: "Ayazkurt",
    epithet: "Gümüş Tüylü Fırtına",
    episode: 9,
    region: "kiragiduzu",
    element: "ayaz",
    description:
      "Rüzgârla birlikte uluyan, nefesiyle çimenleri kırağıya çeviren gümüş tüylü kocaman bir fırtına canavarı. " +
      "Yaklaştığı yerde rüzgâr ıslık çalar, kar taneleri havada dans eder.",
    weakness: "Sıcak kamp ateşi ve cesur şarkılar. Ateşin çıtırtısı ve hep birlikte söylenen türküler onu yatıştırır.",
    resolution:
      "Obanın ateşi başında dinlenen Ayazkurt fırtınasını dindirir; o günden sonra Kırağıdüzü'nde " +
      "yavru kuzuları ve çocukları rüzgârdan koruyan bir dost olur.",
  },
  kisgolgesi_han: {
    id: "kisgolgesi_han",
    name: "Kışgölgesi Han",
    epithet: "Günözü'nün Kadim Muhafızı",
    episode: 12,
    region: "gunozu_tepesi",
    element: "golge",
    description:
      "Günözü Taşı'nın ışığını kendi gölgesinde saklamak isteyen kadim bir muhafız. Asırlarca taşı korurken " +
      "ışığı paylaşmayı unutmuş, kalbi kış gibi soğumuştur.",
    weakness: "Paylaşılan ışık. Obanın her ferdi kendi küçük ışığını taşa uzattığında gölge incelir.",
    resolution:
      "Taş yeniden parlarken Kışgölgesi Han ışığın paylaştıkça çoğaldığını hatırlar; muhafızlığını sürdürür " +
      "ama artık Günözü'nü obayla birlikte korur.",
  },
};

/** Boss'lar, çıktıkları bölüm sırasıyla. */
export const BOSS_LIST: readonly Boss[] = BOSS_IDS.map((id) => BOSSES[id]);
