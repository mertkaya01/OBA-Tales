/**
 * BÖLGELER — obaların yaşadığı 6 bölge ve yeni yoldaşların geldiği orta ada.
 *
 * Yerleşim (dünya birimi 3200 × 2240, y güneye doğru artar):
 *
 *                       Buzultaç            Kalekaya
 *   Kartalyuva                                               Üçkardeş
 *            ┌── Günözü Tepesi ──┐
 *   Martı  Ayazboğazı   Kırağıdüzü ═Batı Kemeri═ KUTADA ═Kadim Kemer═ Pusluada    Fırtınaburnu
 *   Adacık-     │            │                (Kut Kapısı)
 *   ları   Akınburnu ── Süzülkoy                                 Yeşilsırt
 *                       Kuzgunorman
 *
 * Kutada takımadanın tam ortasındadır: yeni yoldaşlar Kut Kapısı'ndan buraya gelir, köprülerden obalarına
 * dağılır. Ana ada batıda, Pusluada doğuda. Komşu bölgeler kenar paylaşır.
 * Çevredeki yabani adalar content/islands.ts içinde; orada kimse yaşamaz, adlarını takipçiler koyar.
 * Kıyılar poligonların dışına taşar ve kenarlarından en fazla PROTECT_DEPTH kadar içeri girebilir (koylar).
 * `unlockEpisode`, bölgenin sisten çıktığı bölümdür; yolculuk sırasını izler:
 *   B1 Akınburnu → B3 Ayazboğazı → B4 Süzülkoy → B5 Kırağıdüzü → B6 Pusluada → B11 Günözü Tepesi
 */
import { REGION_IDS } from "../types";
import type { Catalog, Region, RegionId } from "../types";

export const REGIONS: Catalog<RegionId, Region> = {
  akinburnu: {
    id: "akinburnu",
    name: "Akınburnu",
    tagline: "Teknelerin yanaştığı hareketli başlangıç limanı",
    description:
      "Rüzgâr güllerinin döndüğü, halatların gıcırdadığı, balık kokulu iskelelerin uzandığı canlı liman. " +
      "Her akın burada başlar; Baturay'ın teknesi de, obaya yeni katılan yoldaşlar da ilk olarak bu kıyıya ayak basar.",
    terrain: "liman",
    elevation: 0.15,
    polygon: [
      { x: 240, y: 1425 },
      { x: 375, y: 1290 },
      { x: 600, y: 1268 },
      { x: 690, y: 1380 },
      { x: 645, y: 1545 },
      { x: 435, y: 1590 },
      { x: 285, y: 1530 },
    ],
    center: { x: 473, y: 1425 },
    unlockEpisode: 1,
  },
  suzulkoy: {
    id: "suzulkoy",
    name: "Süzülkoy",
    tagline: "Berrak sulu, sakin dalgalı iç koy",
    description:
      "Dalgaların fısıltıyla kıyıya süzüldüğü, suyu dibindeki çakıllar görünecek kadar berrak bir iç koy. " +
      "Keşif tekneleri burada dinlenir, ağlar kurutulur; akşamüstü koyun üzerine zümrüt renkli bir ışık düşer.",
    terrain: "koy",
    elevation: 0.1,
    polygon: [
      { x: 600, y: 1268 },
      { x: 825, y: 1215 },
      { x: 1035, y: 1260 },
      { x: 1080, y: 1425 },
      { x: 960, y: 1560 },
      { x: 750, y: 1575 },
      { x: 645, y: 1545 },
      { x: 690, y: 1380 },
    ],
    center: { x: 855, y: 1403 },
    unlockEpisode: 4,
  },
  ayazbogazi: {
    id: "ayazbogazi",
    name: "Ayazboğazı",
    tagline: "İki yüksek buz duvarı arasındaki yankılı geçit",
    description:
      "Gökyüzüne uzanan iki buz duvarının arasından kıvrılarak kuzeye çıkan serin geçit. " +
      "Burada söylenen her söz yedi kez yankılanır; buz duvarlarının içinde donmuş eski yapraklar ve deniz kabukları görünür.",
    terrain: "gecit",
    elevation: 0.55,
    polygon: [
      { x: 315, y: 975 },
      { x: 495, y: 855 },
      { x: 645, y: 885 },
      { x: 690, y: 1035 },
      { x: 645, y: 1185 },
      { x: 600, y: 1268 },
      { x: 375, y: 1290 },
      { x: 330, y: 1155 },
    ],
    center: { x: 503, y: 1080 },
    unlockEpisode: 3,
  },
  kiragiduzu: {
    id: "kiragiduzu",
    name: "Kırağıdüzü",
    tagline: "Beyaz çimenleri elmas gibi parlayan geniş yayla",
    description:
      "Sabahları her çimen telinin kırağıyla kaplandığı, güneş vurunca bütün yaylanın elmas tozu gibi parladığı " +
      "uçsuz bucaksız bozkır. Obaların şenlik ocakları burada yakılır, kızaklar burada yarışır.",
    terrain: "yayla",
    elevation: 0.4,
    polygon: [
      { x: 645, y: 885 },
      { x: 795, y: 863 },
      { x: 1050, y: 870 },
      { x: 1170, y: 945 },
      { x: 1185, y: 1155 },
      { x: 1035, y: 1260 },
      { x: 825, y: 1215 },
      { x: 600, y: 1268 },
      { x: 645, y: 1185 },
      { x: 690, y: 1035 },
    ],
    center: { x: 915, y: 1050 },
    unlockEpisode: 5,
  },
  pusluada: {
    id: "pusluada",
    name: "Pusluada",
    tagline: "Bulut örtülü, gizemli taş kemerli yüksek ada",
    description:
      "Ana adanın doğusunda, hafif bir bulut örtüsünün altında yükselen ada. Kayalıkları bulutlara değer, " +
      "yamaçlarında kimin yaptığı bilinmeyen taş kemerler durur. Kadim Kemer, adayı boğazın üzerinden Kutada'ya bağlar.",
    terrain: "yuksek_ada",
    elevation: 0.7,
    polygon: [
      { x: 2045, y: 825 },
      { x: 2195, y: 750 },
      { x: 2345, y: 840 },
      { x: 2360, y: 1035 },
      { x: 2285, y: 1215 },
      { x: 2135, y: 1290 },
      { x: 2030, y: 1185 },
      { x: 2015, y: 990 },
    ],
    center: { x: 2195, y: 1020 },
    unlockEpisode: 6,
  },
  gunozu_tepesi: {
    id: "gunozu_tepesi",
    name: "Günözü Tepesi",
    tagline: "En yüksek noktadaki sıcak taş tapınak ve şenlik alanı",
    description:
      "Adaların en yüksek noktası. Tepedeki taş tapınağın ortasında Günözü Taşı durur; taşın sıcaklığı " +
      "çevresindeki karları eritir, tapınağın avlusunda kış ortasında bile çiçekler açar.",
    terrain: "tepe",
    elevation: 0.95,
    polygon: [
      { x: 645, y: 885 },
      { x: 690, y: 750 },
      { x: 855, y: 653 },
      { x: 1035, y: 675 },
      { x: 1140, y: 795 },
      { x: 1050, y: 870 },
      { x: 795, y: 863 },
    ],
    center: { x: 900, y: 765 },
    unlockEpisode: 11,
  },
  kutada: {
    id: "kutada",
    name: "Kutada",
    tagline: "Yeni yoldaşların Kut Kapısı'ndan ilk adım attığı orta ada",
    description:
      "Takımadanın tam ortasında, rüzgârın bile yavaşladığı çiçekli bir ada. Ortasındaki Kut Kapısı'ndan obaya katılan " +
      "her yeni yoldaş ilk kez buraya adım atar; Konuk obasında soluklanır, sonra köprülerden kendi obasına yolculuğa çıkar.",
    terrain: "cayir",
    elevation: 0.22,
    polygon: [
      { x: 1255, y: 1080 },
      { x: 1290, y: 940 },
      { x: 1400, y: 845 },
      { x: 1560, y: 805 },
      { x: 1720, y: 822 },
      { x: 1850, y: 900 },
      { x: 1945, y: 1080 },
      { x: 1910, y: 1225 },
      { x: 1800, y: 1340 },
      { x: 1620, y: 1395 },
      { x: 1440, y: 1378 },
      { x: 1310, y: 1270 },
    ],
    center: { x: 1600, y: 1050 },
    unlockEpisode: 1,
    hub: true,
  },
};

/** Bölgeler, hikâyedeki açılış sırasına göre. */
export const REGION_LIST: readonly Region[] = [...REGION_IDS]
  .map((id) => REGIONS[id])
  .sort((a, b) => a.unlockEpisode - b.unlockEpisode);
