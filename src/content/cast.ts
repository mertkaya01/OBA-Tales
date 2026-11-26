/**
 * KADRO — lider, anlatıcı, 3 ana karakter, 2 yan karakter ve 3 özel kahraman (egetunce, mhellingtr, BinTaş).
 *
 * Kadro üyeleri de birer `Character`'dır; haritada takipçilerle birlikte görünür.
 * Sezon başında hikâye kadrosu Akınburnu'nda, başlangıç limanındadır; özel kahramanlar Kut Kapısı'nın önünde bekler.
 * Özel kahramanların nadirliği efsanevinin üstündedir (Ulu, Göksel); özel yetenekleri ve elle verilmiş nitelikleri vardır.
 * Platform → sınıf kuralı ve çoklu platform rozetleri takipçilerle aynıdır.
 */
import { toClassInfo } from "./classes";
import type { CastMember, Character, Coordinates, RoleType } from "../types";

/** Rollerin arayüzdeki adları. */
export const ROLE_LABELS: Readonly<Record<RoleType, string>> = {
  leader: "Akın Lideri",
  narrator: "Anlatıcı",
  core: "Ana Kadro",
  side: "Yan Kadro",
  hero: "Özel Kahraman",
  follower: "Takipçi",
};

/** Karakter kadrodan biri mi? (hikâye alanlarına erişmeden önce kontrol için) */
export function isCastMember(character: Character): character is CastMember {
  return character.roleType !== "follower" && "bio" in character;
}

const CAST_UPDATED_AT = "2026-11-24T00:00:00+03:00";
const HEROES_UPDATED_AT = "2026-11-25T00:00:00+03:00";
const NO_CONTRIBUTIONS = { votesCast: 0, raidsJoined: 0 } as const;

export const CAST: readonly CastMember[] = [
  {
    id: "baturay",
    handle: "baturay",
    displayName: "Baturay",
    roleType: "leader",
    platform: "instagram",
    linkedPlatforms: ["instagram", "tiktok", "youtube"],
    class: toClassInfo("kalkaneri"),
    rarity: "efsanevi",
    title: "Akın Başı",
    points: 1200,
    region: "akinburnu",
    coordinates: { x: 495, y: 1380 },
    badges: ["kurucu_oba", "oba_onculugu"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Obanın Sesini Dinleyen Lider",
    bio:
      "Akınburnu'nda doğmuş, ilk teknesini on iki yaşında kendi elleriyle yapmıştır. Neşesi rüzgârdan hızlı " +
      "yayılır; bir karar vermeden önce mutlaka obanın en küçük üyesine de fikrini sorar. Adil, sabırlı ve " +
      "gülmeyi asla unutmayan bir akın lideridir.",
    appearance:
      "Kalın kürk yakalı lacivert kaftan, omzunda oba motifli geniş kalkan, rüzgârda dalgalanan kırmızı atkı.",
    signature: "“Omuz omuza!” diye seslenir; obanın kalkanları ve yürekleri yan yana dizilir.",
  },
  {
    id: "dede_toygar",
    handle: "dede_toygar",
    displayName: "Dede Toygar",
    roleType: "narrator",
    platform: "youtube",
    linkedPlatforms: ["youtube", "instagram", "tiktok"],
    class: toClassInfo("ocakcan"),
    rarity: "efsanevi",
    title: "Obanın Ozanı",
    points: 1100,
    region: "akinburnu",
    coordinates: { x: 405, y: 1485 },
    badges: ["kurucu_oba", "oba_onculugu"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Sazlı Bilge",
    bio:
      "Adaların bütün masallarını bilen yaşlı ozan. Üç telli eski sazını çaldığında rüzgâr bile durup dinler. " +
      "Her bölümün başında hikâyeyi o anlatır, oylamaları obaya o duyurur, sonuçları türküsüne o katar.",
    appearance:
      "Uzun beyaz sakal, yamalı ama rengârenk keçe cübbe, sırtında üç telli saz, boynunda Günözü Taşı'ndan küçük bir kırıntı.",
    signature: "“Dinleyin obanın çocukları…” diye başlar; sazının teli titreyince bölüm açılır.",
  },
  {
    id: "alptug",
    handle: "alptug",
    displayName: "Alptuğ",
    roleType: "core",
    platform: "instagram",
    linkedPlatforms: ["instagram"],
    class: toClassInfo("kalkaneri"),
    rarity: "destansi",
    title: "Ön Saf Kalkaneri",
    points: 860,
    region: "akinburnu",
    coordinates: { x: 600, y: 1343 },
    badges: ["kurucu_oba"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Pirinç Kalkanlı",
    bio:
      "Obanın en geniş omuzlu, en yumuşak kalpli savaşçısı. Kalkanını kimseye vurmak için değil, herkesi " +
      "korumak için taşır. Fırtına ne kadar sert eserse essin, arkasındakiler onun sırtını görünce rahatlar.",
    appearance: "Kürk kenarlı kısa ceket, omzunda parlak pirinç kalkan, boynuna iki kez dolanmış kalın yün atkı.",
    signature: "Kalkan Duvarı: kalkanını yere vurur, arkasındaki herkes rüzgârdan korunur.",
  },
  {
    id: "suheyla",
    handle: "suheyla",
    displayName: "Süheyla",
    roleType: "core",
    platform: "tiktok",
    linkedPlatforms: ["tiktok"],
    class: toClassInfo("okyeli"),
    rarity: "destansi",
    title: "Keşif Okçusu",
    points: 840,
    region: "akinburnu",
    coordinates: { x: 330, y: 1440 },
    badges: ["kurucu_oba"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Kartal Gözlü",
    bio:
      "Adaların en keskin gözlü okçusu. Oklarına halat bağlayarak uçurumlar arasında köprüler kurar; " +
      "sisli havalarda bile yolu ilk o bulur. Haritaya düşülen her yeni çizgide onun izi vardır.",
    appearance: "Hafif deri omuzluk, fildişi rengi kısa yay, başlığında beyaz bir tüy, alnında kar gözlüğü.",
    signature: "Halat Oku: tek atışta iki kıyı arasına sağlam bir halat gerer.",
  },
  {
    id: "kursat",
    handle: "kursat",
    displayName: "Kürşat",
    roleType: "core",
    platform: "youtube",
    linkedPlatforms: ["youtube"],
    class: toClassInfo("ocakcan"),
    rarity: "destansi",
    title: "Ocak Bekçisi",
    points: 820,
    region: "akinburnu",
    coordinates: { x: 525, y: 1508 },
    badges: ["kurucu_oba"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Fenerli Can",
    bio:
      "Obanın şifacısı ve moral kaynağı. Çantasından hiç eksik olmayan sıcak çayı ve küçük davuluyla " +
      "en yorgun yoldaşı bile ayağa kaldırır. Gülüşü, fenerinin ışığı kadar sıcaktır.",
    appearance:
      "Elinde sarı ışıkla parlayan küçük fener, belinde renkli keseler, sırtında küçük oba davulu, yumuşak yün pelerin.",
    signature: "Ocak Çayı: buharı tüten çayını paylaştırır; herkesin içi ısınır, cesareti tazelenir.",
  },
  {
    id: "yalvac",
    handle: "yalvac",
    displayName: "Yalvaç",
    roleType: "side",
    platform: "youtube",
    linkedPlatforms: ["youtube", "instagram"],
    class: toClassInfo("ocakcan"),
    rarity: "efsanevi",
    title: "Kıvılcım Dansçısı",
    points: 980,
    region: "akinburnu",
    coordinates: { x: 608, y: 1470 },
    badges: ["kurucu_oba", "cift_iz"],
    elementAura: "alev",
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Şenlik Alevi",
    bio:
      "Avuçlarında sıcak ama asla yakmayan şenlik kıvılcımları dans eder. Donmuş ellere, üşümüş yüreklere " +
      "sıcaklık taşır; kıvılcımlarıyla gökyüzüne rengârenk desenler çizer. Nerede bir kahkaha varsa oradadır.",
    appearance: "Turuncu-kızıl keçe yelek, bileklerinde bakır bilezikler, saçlarında kor renginde kurdeleler.",
    signature: "Kıvılcım Halayı: kıvılcımlar halka olup döner, çevredeki buzları usulca eritir.",
  },
  {
    id: "isikay",
    handle: "isikay",
    displayName: "Işıkay",
    roleType: "side",
    platform: "tiktok",
    linkedPlatforms: ["tiktok", "youtube"],
    class: toClassInfo("okyeli"),
    rarity: "efsanevi",
    title: "Patika Işığı",
    points: 960,
    region: "akinburnu",
    coordinates: { x: 435, y: 1328 },
    badges: ["kurucu_oba", "cift_iz"],
    elementAura: "isik",
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: CAST_UPDATED_AT,
    epithet: "Berrak Haleli",
    bio:
      "Çevresinde yumuşak, berrak bir ışık halesi taşır. Karanlık patikaları, sisli koyları ve yıldızsız " +
      "geceleri aydınlatır; nereye gitse ardında parıltılı bir iz kalır. Sakin sesiyle en ürkek yoldaşı bile yatıştırır.",
    appearance:
      "Açık mavi ve gümüş işlemeli uzun şal, alnında hilal biçimli ince taç, elinde teli ışıktan billur bir yay.",
    signature: "Hale Yolu: ışık halesini genişletir; karanlıktaki herkes yolunu görür.",
  },
  // ── Özel kahramanlar: efsanevinin üstündeki Ulu ve Göksel kademeler yalnızca onlarda ──
  {
    id: "egetunce",
    handle: "egetunce",
    displayName: "egetunce",
    roleType: "hero",
    platform: "instagram",
    linkedPlatforms: ["instagram", "tiktok", "youtube"],
    class: toClassInfo("kalkaneri"),
    rarity: "ulu",
    title: "Gün Kılıçlı Alp",
    points: 1600,
    region: "kutada",
    coordinates: { x: 1572, y: 1146 },
    badges: ["oba_onculugu", "kurucu_oba"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: HEROES_UPDATED_AT,
    epithet: "Kut Kapısı'nın Bekçisi",
    bio:
      "Kut Kapısı'ndan geçen her yeni yoldaşı ilk o karşılar. Mor kova şapkasının üstündeki iki kocaman göz hiç " +
      "uyumaz; arkadan yaklaşan ayazı bile önceden görür. Elinde hep taze bir lavanta demeti taşır, yanında ise güneş " +
      "ışığından dövülmüş uzun Gün Kılıcı durur. Kılıcını yalnızca buzu yarmak ve yolu açmak için çeker.",
    appearance:
      "Mor kova şapka (üstünde iki iri göz), omuzlara dökülen sarı saçlar, kısa sakal, siyah tişört ve şort, beyaz " +
      "ayakkabılar; bir elinde lavanta demeti, ötekinde sarı-beyaz uzun Gün Kılıcı.",
    signature: "“Önce lavantayı kokla, sonra yola çık!” der; Gün Kılıcı parlayınca en kalın buz bile çatlar.",
    specialAbilities: [
      "Gün Kılıcı: sarı-beyaz kılıcı kınından çıkınca etraf gün ışığıyla dolar, en kalın buz bile çatlar.",
      "Lavanta Kalkanı: lavanta demetinin kokusu obayı sarar; korkan yoldaşlar sakinleşir, kalkanlar iki kat sağlamlaşır.",
      "Uyumayan Gözler: şapkasındaki iki göz arkayı bekler; hiçbir tehlike obayı habersiz yakalayamaz.",
      "Alp Atılımı: ön saftan tek hamlede ileri atılır, yolu kapatan buz duvarını ikiye ayırır.",
    ],
    attributes: {
      guc: 136,
      ceviklik: 94,
      dayaniklilik: 128,
      kut: 106,
      special: { label: "Gün Işığı", description: "Kılıcından taşan güneş: ayazı çözer, karanlığı dağıtır.", value: 125 },
    },
  },
  {
    id: "mhellingtr",
    handle: "mhellingtr",
    displayName: "mhellingtr",
    roleType: "hero",
    platform: "tiktok",
    linkedPlatforms: ["tiktok", "instagram", "youtube"],
    class: toClassInfo("okyeli"),
    rarity: "goksel",
    title: "Yıldızların Okçusu",
    points: 2000,
    region: "kutada",
    coordinates: { x: 1600, y: 1148 },
    badges: ["oba_onculugu", "kurucu_oba"],
    elementAura: null,
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: HEROES_UPDATED_AT,
    epithet: "Obanın En Güçlüsü",
    bio:
      "Göğün en yüksek katından, yıldızların arasından inmiş bir okçu. Tanrı değildir ama gökyüzü onu tanır: yayını " +
      "gerdiğinde yıldızlar bir an parlamayı keser, oku nereye giderse oraya ışık düşer. Obanın en güçlü kahramanıdır; " +
      "yine de en çok kaybolan yoldaşlara yol göstermeyi sever.",
    appearance:
      "Altın kenarlı beyaz kapüşonunun altından kıvırcık kahverengi saçları görünür; başının üstünde yıldızlı altın bir hale. " +
      "Altın kenarlı beyaz zırh ve tabard, takımyıldızlarla işlenmiş gece mavisi pelerin; sırtında uçları kristal oklar, " +
      "elinde köşeli, beyaz-altın Yıldız Yayı ve ışıktan kirişi.",
    signature: "“Gök ne kadar uzaksa okum o kadar yakın.” der; yayından çıkan ok gecede yeni bir yıldız gibi parlar.",
    specialAbilities: [
      "Yıldız Oku: gökten bir yıldız koparıp yayına takar; ok geçtiği her yeri gün gibi aydınlatır.",
      "Gök Kubbe: yayını göğe çevirip obanın üstüne ışıktan bir kubbe gerer; içindekilere ayaz işlemez.",
      "Takımyıldız Atışı: aynı anda yedi ok atar; oklar gökte takımyıldız gibi dizilip bütün buz perdelerini düşürür.",
      "Kutup Yıldızı: sis ne kadar koyu olursa olsun, kaybolan her yoldaşa obanın yolunu gösterir.",
    ],
    attributes: {
      guc: 122,
      ceviklik: 168,
      dayaniklilik: 114,
      kut: 152,
      special: { label: "Yıldız Işığı", description: "Göğün en yüksek katından gelen ışık: obanın en güçlü gücü.", value: 190 },
    },
  },
  {
    id: "bintas",
    handle: "bintas",
    displayName: "BinTaş",
    roleType: "hero",
    platform: "youtube",
    linkedPlatforms: ["youtube", "instagram", "tiktok"],
    class: toClassInfo("ocakcan"),
    rarity: "efsanevi",
    title: "Alev Hatun",
    points: 1400,
    region: "kutada",
    coordinates: { x: 1630, y: 1140 },
    badges: ["oba_onculugu", "kurucu_oba"],
    elementAura: "alev",
    seasonContributions: { ...NO_CONTRIBUTIONS },
    updatedAt: HEROES_UPDATED_AT,
    epithet: "Bin Ocağın Közü",
    bio:
      "Bin taşlı eski bir ocağın külünden doğduğu anlatılır. Saçları hiç sönmeyen bir alev, tacı közden; avucunda " +
      "dönen ateş küresi en soğuk ayazda bile obayı ısıtır. Öfkesiyle değil sıcaklığıyla tanınır: üşüyen her " +
      "yoldaşın yanında biter, sönmeye yüz tutmuş ocakları yeniden yakar.",
    appearance:
      "Közden alev taç, alev gibi dalgalanan saçlar, kırmızı-altın zırhlı elbise, eteğinde alev dilleri, sırtında " +
      "alev kanatları; kaldırdığı elinde dönen ateş küresi.",
    signature: "“Ocak sönmez, yeter ki biri üflesin.” der; ateş küresi parlayınca bütün oba ısınır.",
    specialAbilities: [
      "Bin Taş Ocağı: yere bin küçük kor taşı serper; obanın çevresinde sönmeyen sıcak bir halka yanar.",
      "Alev Kanatları: kanatlarını açar, üşüyen yoldaşları sıcak bir rüzgârla sarar.",
      "Ateş Küresi: avucundaki küreyi fırlatır; yolu kapatan buz duvarı buhar olup uçar.",
    ],
  },
];

/** Özel kahramanların çevresi: yeni gelenler bu mesafeden yakına konmaz (kalabalıkta kaybolmasınlar). */
export const HERO_CLEARANCE = 16;

export function nearHero(p: Coordinates): boolean {
  return CAST.some((c) => c.roleType === "hero" && Math.hypot(c.coordinates.x - p.x, c.coordinates.y - p.y) < HERO_CLEARANCE);
}

/** Kimliğe göre kadro üyesi. */
export function findCastMember(id: string): CastMember | undefined {
  return CAST.find((member) => member.id === id);
}
