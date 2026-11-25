/**
 * BİRİNCİ SEZON — 12 bölüm.
 *
 * Her bölümün 1 ya da 2 oylama sorusu vardır; takipçiler yorumlarda seçenek adını yazarak oy verir.
 * Oy sonuçları ve aktif bölüm public/data/season.json içinde tutulur.
 * Kimlik kuralları: bölüm "b01-…", oylama "b01-…", seçenek kısa ve küçük harfli.
 */
import type { Episode, EpisodeStatus } from "../types";

/** Bölüm durumlarının arayüzdeki adları. */
export const EPISODE_STATUS_LABELS: Readonly<Record<EpisodeStatus, string>> = {
  kilitli: "Kilitli",
  yakinda: "Yakında",
  aktif: "Akın sürüyor",
  tamamlandi: "Tamamlandı",
};

export const EPISODES: readonly Episode[] = [
  {
    number: 1,
    id: "b01-obaya-ilk-adim",
    title: "Obaya İlk Adım",
    summary:
      "Akın teknesi Akınburnu'na yanaşır. Baturay obanın yeni yoldaşlarını tek tek karşılar, Dede Toygar " +
      "sazını akort eder ve sezonun ilk keşif rotası seçilir.",
    region: "akinburnu",
    bossId: null,
    polls: [
      {
        id: "b01-rota",
        question: "İlk keşif rotası hangi kıyı olsun?",
        options: [
          { id: "kuzey-kayaliklari", label: "Kuzey Kayalıkları", description: "Buz duvarlarına doğru tırmanan serin patika." },
          { id: "bati-kumsali", label: "Batı Kumsalı", description: "Deniz kabuklarıyla dolu, sessiz ve rüzgârlı kıyı." },
          { id: "dogu-iskelesi", label: "Doğu İskelesi", description: "Sönmüş eski fenere uzanan tahta iskele." },
        ],
      },
    ],
  },
  {
    number: 2,
    id: "b02-fisiltili-iskele",
    title: "Fısıltılı İskele",
    summary:
      "Gece rüzgârında fısıldayan eski iskelenin ucundaki fener sönmüştür. Oba hem feneri onarmalı " +
      "hem de kuleye obanın yeni sembolünü asmalıdır.",
    region: "akinburnu",
    bossId: null,
    polls: [
      {
        id: "b02-onarim",
        question: "Feneri önce kim onarsın?",
        options: [
          { id: "alptug", label: "Alptuğ", description: "Kalkanını merdiven yapıp kuleye ilk o tırmanır." },
          { id: "suheyla", label: "Süheyla", description: "Halat okuyla kulenin tepesine sağlam bir ip bağlar." },
          { id: "kursat", label: "Kürşat", description: "Kendi fenerinin ateşini kulenin kandiline aktarır." },
        ],
      },
      {
        id: "b02-sembol",
        question: "Kuleye hangi sembol asılsın?",
        options: [
          { id: "gunes-cemberi", label: "Güneş Çemberi", description: "Günözü Taşı'nı hatırlatan altın halka." },
          { id: "uc-dalga", label: "Üç Dalga", description: "Adaları saran denizin ve üç platformun simgesi." },
          { id: "oba-agaci", label: "Oba Ağacı", description: "Kökleri birbirine dolanmış hayat ağacı." },
        ],
      },
    ],
  },
  {
    number: 3,
    id: "b03-buzul-gecidi",
    title: "Buzul Geçidi",
    summary:
      "Ayazboğazı'nın buz duvarları arasında Buzkıran Tekgöz yolu kapatır. Oba, devi korkutmadan " +
      "geçidi açmanın bir yolunu bulmalıdır.",
    region: "ayazbogazi",
    bossId: "buzkiran_tekgoz",
    polls: [
      {
        id: "b03-taktik",
        question: "Cesaret taktiği mi, buz eritme planı mı?",
        options: [
          { id: "cesaret", label: "Cesaret Taktiği", description: "Kalkaneriler ön safta durur, Tekgöz'ün dikkatini üstlerine çeker." },
          { id: "buz-eritme", label: "Buz Eritme Planı", description: "Ocakcanlar ateş ve ninniyle buz çekirdeğini yavaşça ısıtır." },
        ],
      },
    ],
  },
  {
    number: 4,
    id: "b04-kayip-tekne",
    title: "Kayıp Tekne",
    summary:
      "Geçidin ötesinde, berrak sulu Süzülkoy'da halatı kopmuş bir keşif teknesi sürüklenmektedir. " +
      "İçinde obanın yıllardır kayıp sanılan eski haritaları vardır.",
    region: "suzulkoy",
    bossId: null,
    polls: [
      {
        id: "b04-yanasma",
        question: "Tekneye doğrudan mı yanaşılsın, kıyıdan halat mı atılsın?",
        options: [
          { id: "dogrudan", label: "Doğrudan Yanaşmak", description: "Hızlı ama akıntıya dikkat etmek gerekir." },
          { id: "halat", label: "Kıyıdan Halat Atmak", description: "Okyeliler halat okuyla tekneyi kıyıya çeker." },
        ],
      },
    ],
  },
  {
    number: 5,
    id: "b05-ocak-senligi",
    title: "Ocak Şenliği",
    summary:
      "Kırağıdüzü'nün elmas gibi parlayan çimenlerinde büyük ocak yakılır. Obalar takım oyunlarıyla " +
      "yarışır, Dede Toygar türküler söyler, gece yıldızlarla dolar.",
    region: "kiragiduzu",
    bossId: null,
    polls: [
      {
        id: "b05-oyun",
        question: "Hangi takım oyunu oynansın?",
        options: [
          { id: "halat-cekme", label: "Halat Çekme" },
          { id: "kizak-yarisi", label: "Kızak Yarışı" },
          { id: "kartopu-kalesi", label: "Kartopu Kalesi" },
        ],
      },
      {
        id: "b05-odul",
        question: "Şenlik sancağı ödülü kimde kalsın?",
        options: [
          { id: "kazanan-takim", label: "Kazanan Takımda" },
          { id: "en-genc", label: "Obanın En Genç Yoldaşında" },
          { id: "ortak-ocak", label: "Herkesin Ortak Ocağında" },
        ],
      },
    ],
  },
  {
    number: 6,
    id: "b06-sisli-liman",
    title: "Sisli Liman",
    summary:
      "Pusluada'nın limanı koyu bir sisle kaplanır; pusulalar şaşırır, fenerler kararır. Sisin içinden " +
      "Sisçi Karaçay'ın dumandan yelkenleri belirir.",
    region: "pusluada",
    bossId: "sisci_karacay",
    polls: [
      {
        id: "b06-yol",
        question: "Sis içinde fener zinciri mi kurulsun, sesle mi yol bulunsun?",
        options: [
          { id: "fener-zinciri", label: "Fener Zinciri", description: "Herkes bir fener tutar, ışıklar el ele bir yol çizer." },
          { id: "ses-yolu", label: "Ses Yolu", description: "Oba davulu ve türküler birbirine seslenerek yolu gösterir." },
        ],
      },
    ],
  },
  {
    number: 7,
    id: "b07-kirik-pusula",
    title: "Kırık Pusula",
    summary:
      "Karaçay'ın güvertesinde ibresi ikiye ayrılmış kadim bir pusula taşı bulunur. Taş, kırık hâliyle " +
      "bile hâlâ Günözü Tepesi'ni göstermeye çalışmaktadır.",
    region: "pusluada",
    bossId: null,
    polls: [
      {
        id: "b07-tas",
        question: "Taş obaya mı götürülsün, yerinde mi mühürlensin?",
        options: [
          { id: "obaya", label: "Obaya Götürülsün", description: "Dede Toygar taşın sırrını çözmeye çalışır." },
          { id: "muhur", label: "Yerinde Mühürlensin", description: "Taş, Pusluada'nın taş kemerlerinden birine güvenle yerleştirilir." },
        ],
      },
    ],
  },
  {
    number: 8,
    id: "b08-yuksek-kayalik",
    title: "Yüksek Kayalık",
    summary:
      "Pusluada'nın bulutlara değen kayalıklarına tırmanmak gerekir. Halatlar birbirine bağlanır; " +
      "herkes bir öncekine güvenir, kimse geride bırakılmaz.",
    region: "pusluada",
    bossId: null,
    polls: [
      {
        id: "b08-on",
        question: "Tırmanışta ön grubu kim çeksin?",
        options: [
          { id: "alptug", label: "Alptuğ", description: "Kalkanıyla düşen taşları savuşturur." },
          { id: "suheyla", label: "Süheyla", description: "Halat oklarıyla tutunma noktaları kurar." },
          { id: "isikay", label: "Işıkay", description: "Işık halesiyle bulutların içindeki yolu aydınlatır." },
        ],
      },
      {
        id: "b08-arka",
        question: "Arka güvenliği kim alsın?",
        options: [
          { id: "kursat", label: "Kürşat", description: "Yorulanlara çay ve cesaret taşır." },
          { id: "yalvac", label: "Yalvaç", description: "Kıvılcımlarıyla üşüyen elleri ısıtır." },
          { id: "baturay", label: "Baturay", description: "Herkesi sayar, son tırmanan o olur." },
        ],
      },
    ],
  },
  {
    number: 9,
    id: "b09-ayaz-firtinasi",
    title: "Ayaz Fırtınası",
    summary:
      "Kırağıdüzü'ne dönen oba, ufukta uluyan bir fırtınayla karşılaşır. Ayazkurt'un nefesi çimenleri " +
      "buz kristallerine çevirir, ocakların alevi titrer.",
    region: "kiragiduzu",
    bossId: "ayazkurt",
    polls: [
      {
        id: "b09-taktik",
        question: "Sıcak kamp ateşini savunmak mı, fırtınanın gözüne yürümek mi?",
        options: [
          { id: "kamp-atesi", label: "Kamp Ateşini Savunmak", description: "Oba ateşin etrafında halka olur, türküler yükselir." },
          { id: "firtinanin-gozu", label: "Fırtınanın Gözüne Yürümek", description: "Cesur bir grup Ayazkurt'un yanına kadar gidip onunla konuşur." },
        ],
      },
    ],
  },
  {
    number: 10,
    id: "b10-kadim-kemer",
    title: "Kadim Kemer",
    summary:
      "Pusluada'yı Kutada'ya bağlayan kadim taş kemerin ortasında derin bir çatlak açılmıştır. " +
      "Onarmak için obanın sezon boyunca biriktirdiği kaynaklardan biri harcanacaktır.",
    region: "pusluada",
    bossId: null,
    polls: [
      {
        id: "b10-kaynak",
        question: "Köprüdeki çatlağı onarmak için hangi kaynak harcansın?",
        options: [
          { id: "ocak-harci", label: "Ocak Harcı", description: "Şenlik ocağının sıcak külünden yoğrulmuş harç." },
          { id: "buz-kristali", label: "Buz Kristali", description: "Buzkıran Tekgöz'ün obaya hediye ettiği kristal." },
          { id: "pusula-parcasi", label: "Pusula Taşı Parçası", description: "Kırık pusulanın yön bilen bir parçası." },
        ],
      },
    ],
  },
  {
    number: 11,
    id: "b11-isik-kavsagi",
    title: "Işık Kavşağı",
    summary:
      "Günözü Tepesi'nin eteğinde üç yol birleşir; her biri başka bir ışıkla parlar. Işıkay patikaları " +
      "aydınlatır, Yalvaç soğuğu ısıtır, oba son tırmanışa hazırlanır.",
    region: "gunozu_tepesi",
    bossId: null,
    polls: [
      {
        id: "b11-yol",
        question: "Hangi yoldan ilerlensin?",
        options: [
          { id: "altin-patika", label: "Altın Patika", description: "Uzun ama güneşli, rüzgârdan korunaklı." },
          { id: "gumus-merdiven", label: "Gümüş Merdiven", description: "Buzdan oyulmuş, kısa ama dik basamaklar." },
          { id: "kizil-yokus", label: "Kızıl Yokuş", description: "Yalvaç'ın kıvılcımlarıyla ısınan sıcak taşlı yol." },
        ],
      },
      {
        id: "b11-fikir",
        question: "Kimin fikri öncelik alsın?",
        options: [
          { id: "baturay", label: "Baturay", description: "Obanın çoğunluğunun sesini dinleyelim." },
          { id: "yalvac", label: "Yalvaç", description: "Önce herkes ısınsın, sonra yola çıkalım." },
          { id: "isikay", label: "Işıkay", description: "Işığın en parlak olduğu yolu izleyelim." },
        ],
      },
    ],
  },
  {
    number: 12,
    id: "b12-gunozunun-uyanisi",
    title: "Günözü'nün Uyanışı",
    summary:
      "Tepedeki sıcak taş tapınakta Kışgölgesi Han, Günözü Taşı'nın ışığını gölgesinde saklar. Oba ışığını " +
      "paylaşır, taş uyanır ve Ayazlı Adalar'a bahar gelir.",
    region: "gunozu_tepesi",
    bossId: "kisgolgesi_han",
    polls: [
      {
        id: "b12-kutlama",
        question: "Zaferin ardından oba hangi büyük kutlamayla sezonu kapatsın?",
        options: [
          { id: "fener-alayi", label: "Fener Alayı", description: "Herkes elinde fenerle tepeden limana kadar yürür." },
          { id: "davul-senligi", label: "Büyük Davul Şenliği", description: "Bütün obaların davulları aynı ritimde çalar." },
          { id: "yildiz-gecesi", label: "Yıldız-Ayaz Gecesi", description: "Gökyüzünde kutup ışıkları, ocak başında masallar." },
        ],
      },
    ],
  },
];

/** Bölüm numarasına göre bölüm (1–12). */
export function getEpisode(episodeNumber: number): Episode | undefined {
  return EPISODES.find((ep) => ep.number === episodeNumber);
}
