# Yayına giriş planı

Site, videolar ve takipçi akışı birlikte çalışır: **video izlenir → takip + yorum → yorumcu haritada Kut Kapısı'ndan
doğar → sonraki videoda o görünür.** Bu döngü her hafta döner.

## 1. Yayından önce (bir kez)

| İş | Nasıl | Kim |
|---|---|---|
| Siteyi yayına al | README → "Yayına alma (Cloudflare Pages)". Git deposu ve Cloudflare ayarları hazır; GitHub deposu ve Cloudflare hesabı senin | Sen |
| Adresi yaz | Site adresi belli olunca `.env` → `VITE_SITE_URL` (paylaşım kartı bu adresi kullanır) | Ben ya da sen |
| Örnek takipçileri sil | `npm run takipci:ekle -- --sifirla` (bkz. docs/hesaplar.md) | Sen |
| Bio bağlantısı | Üç hesabın bio'suna site adresi | Sen |
| Telefonda dene | Siteyi telefondan aç: dünya, harita, Katıl sayfası, karakter arama | Sen |

İlk günlerde harita boş görünmesin diye **kadro (7 kahraman) zaten haritada**; ilk yorumcular Kut Kapısı'nın önünde
toplanmaya başlar.

## 2. Videoları üretmek: Reel Stüdyosu

Sitede sayfa altından **Reel Stüdyosu** (`/studyo`). Her şablon 15–20 saniyelik (Akın Günü 36 saniye), 9:16 dikey,
altyazılı ve kural kartlı video çeker; **Kaydet** MP4 indirir (Chrome'da MP4, diğerlerinde WebM). **Kapak** düğmesi
kapak resmini indirir. **Müzik ve efektler** açıksa davul, kopuz ve akın sesleri videoya da girer.

İpuçları:
- Kaydederken sekmeyi ön planda tut (arka plandaki sekmede tarayıcı kareleri yavaşlatır).
- Altyazıları sayfadaki kutudan değiştirebilirsin; her satır bir altyazı.
- Saat seçimi videonun ışığını belirler (gece: ateşler ve portal parlar; akşamüstü: altın ışık).
- **Akın Günü** şablonu aktif bölümün akınını çeker: Öfke çubuğu, perde başlıkları ve saftaki takipçilerin adları
  ekranda çıkar. Bölüm haftası boyunca paylaşmak için en güçlü video budur.

## 3. İlk iki hafta: video sırası

| Gün | Şablon | Amaç | Örnek açıklama |
|---|---|---|---|
| 1 | **Kut Kapısı** (`kapi`) | Tanıtım: "Her takipçi bir karakter" | Takımadanın ortasında Kut Kapısı açıldı. Takip et, yoruma adını yaz: karakterin buradan doğsun. |
| 2 | **Obaya katıl** (`katil`) | Kurallar: platform = sınıf, çift iz | Instagram Kalkaneri, TikTok Okyeli, YouTube Ocakcan yapar. İkisinde takip edersen nadirliğin artar! |
| 3 | **Kahraman** (`kahraman`) | İlk gelenlerden birini öne çıkar | @kullanici obaya katıldı! Sıradaki sen ol. |
| 4 | **Adsız ada** (`ada`) | Topluluk oyunu: ad koyma | Bu adanın adı yok. En beğenilen yorum adını koyar, haritada adı yazar. |
| 5 | **Bölüm tanıtımı** (`bolum`) | Sezon başlıyor: Bölüm 1 | Bölüm 1: obanın ilk kararı yorumlarda. Hangisi? |
| 5+ | **Akın Günü** (`akin`) | Akın haftası: adı geçenler paylaşır | Akında adın geçti mi? Videoda ara, kendini etiketle! |
| 6 | **Kut Kapısı** | İlk haftanın yeni gelenleri | Bu hafta X yeni yoldaş geldi! Kendini haritada bul: (site) |
| 7 | **Kahraman** | Ad koyma kazananı | Adayı @kullanici adlandırdı: "…". Haritada adı yazıyor! |
| 8–14 | Bölüm + Kahraman + Kut Kapısı dönüşümlü | Haftalık döngü | |

Aynı videoyu üç platforma da yükle; her platformun açıklamasında o platformun sınıfını vurgula (Instagram'da
"Kalkaneriler", TikTok'ta "Okyeliler", YouTube'da "Ocakcanlar").

**Etiket önerileri:** `#obatales #oba #türkmitolojisi #pixelart #topluluk #rpg #karakteroluştur` (her videoda 4–6 tane yeter).

## 4. Haftalık döngü (yaklaşık 20 dakika)

1. **Yorumları topla**
   - YouTube: `npm run youtube:yorumlar` (anahtar kurulduktan sonra otomatik).
   - Instagram ve TikTok: yorum yapanların kullanıcı adlarını `veri/girdi/` içine CSV olarak ekle.
2. **Haritaya ekle:** `npm run takipci:ekle` → yeni gelenler Kut Kapısı'nın önünde.
3. **Oylamayı işle:** `public/data/season.json` → bölümün oy sayıları ve kazanan (README → "Canlı veriyi güncellemek").
4. **Ad koyma kazananını yaz:** `public/data/world.json` → `namedPlaces` (ör. `{ "place": "kartalyuva", "name": "…", "namedBy": "kullanici_id" }`).
5. **Yayına gönder:** `npm run data:check`, sonra Cloudflare'e gönder (git ile otomatik).
6. **Videoyu çek:** Reel Stüdyosu'nda "Kut Kapısı" (sayaç yeni gelen sayısını kendisi yazar) ve kazananlar için "Kahraman".

## 5. Ölçmek

İlk iki hafta her videoda şunlara bak: izlenme, yorum sayısı, takip. En çok yorum alan şablonu üçüncü haftada daha sık
kullan. Haritadaki yeni gelen sayısı (Kut Kapısı etiketindeki "N yeni") büyümenin en doğrudan göstergesi.
