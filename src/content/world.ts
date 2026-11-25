/**
 * EVREN — OBA-Tales dünyasının adı, sloganı ve ana hikâyesi.
 * Ana sayfa başlığı, alt bilgi, Obaya Katıl sayfası ve meta açıklamalar buradan beslenir.
 */
export const WORLD = {
  name: "OBA-Tales",
  archipelago: "Ayazlı Adalar",
  tagline: "Ayazlı Adalar'daki Akın Obaları",
  slogan: "Buzlu rüzgâr eser, oba omuz omuza verir; her takipçinin izi bu destanda yaşar.",

  heartStone: {
    name: "Günözü Taşı",
    description:
      "Günözü Tepesi'ndeki sıcak taş tapınakta duran kadim taş. Işığı adaların üzerine yayıldıkça " +
      "denizler çözülür, ocaklar tüter. Işığı zayıfladığında kışlar sertleşir, kadim gölgeler uyanır.",
  },

  summary:
    "Buz tutmuş dalgalar arasındaki Ayazlı Adalar'da oba klanları birlikte yaşar. Adaların " +
    "sıcaklığını koruyan Günözü Taşı zayıfladığında obalar hem sert kışlara hem de kadim gölgelere " +
    "karşı omuz omuza durur. Takipçilerin yorumlardaki kararları hikâyenin gidişatını ve " +
    "karakterlerin nadirliğini etkiler.",

  /** Dede Toygar'ın sezon açılış anlatısı (ana sayfa ve /bolumler girişinde). */
  intro: [
    "Dinleyin obanın çocukları! Ayazlı Adalar'da rüzgâr bu kış her zamankinden erken esti. " +
      "Limanlarda teknelerin halatları dondu, ocakların dumanı göğe ince ince yükseldi.",
    "Çünkü Günözü Taşı yorgun düştü. Işığı her gece biraz daha soluk, gölgeleri her sabah biraz daha uzun.",
    "Ama bir oba, omuz omuza verdiğinde hiçbir kış ona yetişemez. Baturay akın teknesini hazırladı; " +
      "Kalkaneriler kalkanlarını, Okyeliler yaylarını, Ocakcanlar fenerlerini kuşandı. " +
      "Şimdi sıra sizde: her yorumunuz, bu destana atılan bir iz olacak.",
  ],

  season: {
    number: 1,
    title: "Birinci Sezon: Ayazın Ardındaki Işık",
  },
} as const;
