/**
 * NADİRLİKLER — pin çerçevesi, kart stili ve harita görünümü nadirliğe göre değişir.
 * Renkler ve animasyonlar src/index.css token'larında; burada yalnızca metin ve kurallar var.
 * Ulu ve Göksel efsanevinin üstündeki özel kademelerdir: takipçiler kazanamaz, yalnızca özel kahramanlara verilir.
 */
import { RARITIES } from "../types";
import type { Catalog, Rarity, RarityDefinition } from "../types";

export const RARITY_INFO: Catalog<Rarity, RarityDefinition> = {
  siradan: {
    id: "siradan",
    rank: 0,
    label: "Sıradan",
    title: "Çırak",
    description: "Her destan bir ilk adımla başlar. Obaya yeni katılan, öğrenmeye hevesli yoldaşlar.",
    frameLabel: "Düz yün çerçeve",
    visuals: ["Sade yün kıyafet", "Deri kayış", "Tek küçük rozet", "Düz harita pini"],
    hasAura: false,
    hasTrail: false,
  },
  nadir: {
    id: "nadir",
    rank: 1,
    label: "Nadir",
    title: "Yoldaş",
    description: "Obanın güvendiği, akınlarda omuz veren yoldaşlar. Adları ocak başlarında anılmaya başlar.",
    frameLabel: "Zümrüt / Süzülkoy çerçeve",
    visuals: ["Belirgin oba motifleri", "Renkli şal", "Kabza oymaları", "Zümrüt çerçeveli pin"],
    hasAura: false,
    hasTrail: false,
  },
  destansi: {
    id: "destansi",
    rank: 2,
    label: "Destansı",
    title: "Başeri",
    description: "Akınlara öncülük eden başerler. Geçtikleri yerde hafif bir Günözü parıltısı kalır.",
    frameLabel: "Mor-altın / Günözü çerçeve",
    visuals: ["Parlak metal kenarlıklar", "Uzun pelerin", "Özel madalyon", "Belirgin aura"],
    hasAura: true,
    hasTrail: false,
  },
  efsanevi: {
    id: "efsanevi",
    rank: 3,
    label: "Efsanevi",
    title: "Efsane",
    description: "Dede Toygar'ın türkülerine giren efsaneler. Adımlarının ardında yıldız-ayaz izi parlar.",
    frameLabel: "Kızıl-altın / Alev-Işık çerçeve",
    visuals: [
      "Altın-gümüş işlemeler",
      "Parlayan kadim tüy ve rüzgâr teli",
      "Hareketli aura",
      "Yıldız-ayaz izi",
    ],
    hasAura: true,
    hasTrail: true,
  },
  ulu: {
    id: "ulu",
    rank: 4,
    label: "Ulu",
    title: "Alp",
    description:
      "Efsanelerin de üstünde, adı destanlara kazınmış alpler. Takipçiler bu kademeye ulaşamaz; " +
      "obanın yalnızca birkaç özel kahramanına verilir. Geçtikleri yerde güneş ışığı kalır.",
    frameLabel: "Güneş altını / Gün Kılıcı çerçeve",
    visuals: ["Güneş altını işlemeler", "Göğüste güneş amblemi", "Altın aura", "Gün ışığı izi"],
    hasAura: true,
    hasTrail: true,
  },
  goksel: {
    id: "goksel",
    rank: 5,
    label: "Göksel",
    title: "Gökeri",
    description:
      "Göğün en yüksek katından inmiş, yıldızlarla konuşan kahramanlar. Tanrı değil ama ona en yakın olan: " +
      "obanın en güçlüsü. Takipçiler ulaşamaz; yalnızca özel kahramanlara verilir.",
    frameLabel: "Yıldız ışığı / Gök Kubbe çerçeve",
    visuals: ["Yıldızlı gece pelerini", "Parlayan yıldız yayı", "Yıldız ışığı aurası", "Başında süzülen yıldızlar"],
    hasAura: true,
    hasTrail: true,
  },
};

/** Nadirlikler, düşükten yükseğe. */
export const RARITY_LIST: readonly RarityDefinition[] = RARITIES.map((id) => RARITY_INFO[id]);
