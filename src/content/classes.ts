/**
 * SINIFLAR — takip edilen platform başlangıç sınıfını belirler.
 *   Instagram → Kalkaneri (Savaşçı)
 *   TikTok    → Okyeli    (Menzilli)
 *   YouTube   → Ocakcan   (Destek)
 */
import { CLASS_IDS } from "../types";
import type { Catalog, ClassDefinition, ClassId, ClassInfo } from "../types";

export const CLASSES: Catalog<ClassId, ClassDefinition> = {
  kalkaneri: {
    id: "kalkaneri",
    name: "Kalkaneri",
    archetype: "savasci",
    archetypeLabel: "Savaşçı",
    platform: "instagram",
    platformLabel: "Instagram",
    role: "Ön safta durur, arkadaşlarını korur.",
    description:
      "Kalkaneriler obanın duvarıdır. Fırtına ilk onlara çarpar, buz kütleleri ilk onların kalkanında " +
      "durur. Baltalarını yalnızca buzu kırmak ve yol açmak için kullanırlar; asıl güçleri, arkalarındaki " +
      "herkesi güvende tutmaktır.",
    appearance: [
      "Kürk kenarlı kısa ceket",
      "Omuzda parlak pirinç kalkan",
      "Kalın yün atkı",
      "Kısa saplı buz baltası",
    ],
    abilities: [
      "Kalkan Duvarı: kalkanlar yan yana dizilir, rüzgâr ve buz arkaya geçemez.",
      "Oba Narası: yüksek sesle obayı toplar, korkanlara cesaret verir.",
      "Buz Kırıcı: yolu kapatan buz kütlelerini baltasıyla parçalar.",
    ],
  },
  okyeli: {
    id: "okyeli",
    name: "Okyeli",
    archetype: "menzilli",
    archetypeLabel: "Menzilli",
    platform: "tiktok",
    platformLabel: "TikTok",
    role: "Uzaktan isabetli atış yapar, keşifle yolu açar.",
    description:
      "Okyeliler rüzgârın yönünü okur, uzak kıyıları ilk onlar görür. Halat oklarıyla uçurumlar arasına " +
      "köprü gerer, buz oklarıyla yolu kapatan sarkıtları düşürürler. Obanın gözü ve haritasıdırlar.",
    appearance: [
      "Hafif deri omuzluk",
      "Fildişi rengi kısa yay",
      "Başlıkta tüy",
      "Koruyucu kar gözlüğü",
    ],
    abilities: [
      "Halat Oku: iki kıyı arasına sağlam bir halat köprüsü gerer.",
      "Buz Oku: yolu kapatan sarkıtları ve buz perdelerini düşürür.",
      "Kartal Gözü: sisin ve karın ardındaki patikaları görür.",
    ],
  },
  ocakcan: {
    id: "ocakcan",
    name: "Ocakcan",
    archetype: "destek",
    archetypeLabel: "Destek",
    platform: "youtube",
    platformLabel: "YouTube",
    role: "Can ve moral yükseltir, ekibi sıcak tutar.",
    description:
      "Ocakcanlar obanın kalbidir. Sıcak çayları üşüyen elleri ısıtır, şifalı otları yorgunluğu alır, " +
      "oba davulları herkesi aynı ritimde buluşturur. Fenerleri yandıkça en karanlık gece bile kısalır.",
    appearance: [
      "Sıcak parlayan küçük el feneri",
      "Renkli ot ve çay keseleri",
      "Sırtında küçük oba davulu",
      "Yumuşak yün pelerin",
    ],
    abilities: [
      "Ocak Çayı: buharı tüten çayıyla canı ve sıcaklığı tazeler.",
      "Oba Davulu: ritmiyle moral yükseltir, kaybolanlara yol gösterir.",
      "Fener Işığı: karanlık patikaları ve sisli koyları aydınlatır.",
    ],
  },
};

/** Platformların görünen adları. */
export const PLATFORM_LABELS: Readonly<Record<ClassDefinition["platform"], string>> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/** Sınıflar, gösterim sırasıyla. */
export const CLASS_LIST: readonly ClassDefinition[] = CLASS_IDS.map((id) => CLASSES[id]);

/** Karakter verisinde taşınan kısa sınıf bilgisi. */
export function toClassInfo(id: ClassId): ClassInfo {
  const def = CLASSES[id];
  return { id: def.id, name: def.name, archetype: def.archetype };
}
