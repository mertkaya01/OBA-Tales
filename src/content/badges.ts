/**
 * ROZETLER — karakter kartında ve çekmecede gösterilir.
 * `icon` değeri lucide-react simge adıdır (kebab-case); arayüz bu adla simgeyi seçer.
 */
import { BADGE_IDS } from "../types";
import type { BadgeDefinition, BadgeId, Catalog } from "../types";

export const BADGES: Catalog<BadgeId, BadgeDefinition> = {
  cift_iz: {
    id: "cift_iz",
    name: "Çift İz",
    description: "İki ayrı patikadan obaya ulaşan yoldaş.",
    howToEarn: "İki platformda takip et. Başlangıç nadirliğin bir kademe yükselir.",
    icon: "footprints",
  },
  oba_onculugu: {
    id: "oba_onculugu",
    name: "Oba Öncülüğü",
    description: "Üç kıyıdan da sancak taşıyan, obanın öncü yoldaşı.",
    howToEarn: "Instagram, TikTok ve YouTube'un üçünde de takip et.",
    icon: "flag",
  },
  kurucu_oba: {
    id: "kurucu_oba",
    name: "Kurucu Oba",
    description: "Destanın ilk günden beri yanında olan kadro üyesi.",
    howToEarn: "OBA-Tales kadrosuna özeldir.",
    icon: "tent",
  },
  ilk_adim: {
    id: "ilk_adim",
    name: "İlk Adım",
    description: "Akınburnu'na ilk yanaşan teknede yer aldı.",
    howToEarn: "Bölüm 1 akınına katıl.",
    icon: "sprout",
  },
  buzkiran_akini: {
    id: "buzkiran_akini",
    name: "Buzkıran Akını",
    description: "Ayazboğazı'nda Tekgöz'ün buz çekirdeğini eriten akında vardı.",
    howToEarn: "Bölüm 3 boss akınına katıl.",
    icon: "snowflake",
  },
  senlik_neferi: {
    id: "senlik_neferi",
    name: "Şenlik Neferi",
    description: "Kırağıdüzü'ndeki büyük Ocak Şenliği'nde takımıyla yarıştı.",
    howToEarn: "Bölüm 5 akınına katıl.",
    icon: "party-popper",
  },
  sis_yaran: {
    id: "sis_yaran",
    name: "Sis Yaran",
    description: "Pusluada limanında Sisçi Karaçay'ın sisini dağıtanlardan.",
    howToEarn: "Bölüm 6 boss akınına katıl.",
    icon: "compass",
  },
  ayaz_dindiren: {
    id: "ayaz_dindiren",
    name: "Ayaz Dindiren",
    description: "Ayazkurt'un fırtınasını ateş ve türküyle yatıştıran obadaydı.",
    howToEarn: "Bölüm 9 boss akınına katıl.",
    icon: "wind",
  },
  gunozu_bekcisi: {
    id: "gunozu_bekcisi",
    name: "Günözü Bekçisi",
    description: "Günözü Taşı yeniden uyandığında ışığını taşa uzatanlardan.",
    howToEarn: "Bölüm 12 boss akınına katıl.",
    icon: "sun",
  },
  ozan_dostu: {
    id: "ozan_dostu",
    name: "Ozan Dostu",
    description: "Dede Toygar'ın her sorusuna kulak veren, sesini hiç esirgemeyen yoldaş.",
    howToEarn: "Sezon boyunca en az 10 oylamada yorumla oy kullan.",
    icon: "music",
  },
};

/** Rozetler, gösterim sırasıyla. */
export const BADGE_LIST: readonly BadgeDefinition[] = BADGE_IDS.map((id) => BADGES[id]);
