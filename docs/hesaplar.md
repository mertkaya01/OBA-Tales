# Hesapları haritaya bağlamak

Hedef: Instagram, TikTok ve YouTube'daki gerçek takipçiler haritada karakter olarak yaşasın; yeni gelen Kut Kapısı'ndan
doğsun, yorumlar oylama olsun.

## Önce gerçek durum: platformlar ne veriyor?

| Platform | Takipçi listesi | Yorumlar | Ne yapıyoruz |
|---|---|---|---|
| **YouTube** | Resmî API vermiyor (yalnızca abone sayısı) | **Veriyor**: herkese açık yorumlar, ücretsiz API anahtarıyla | Yorum yapanlar otomatik çekilir (`npm run youtube:yorumlar`) |
| **Instagram** | Resmî API vermiyor | Kendi gönderinin yorumları, yalnızca İşletme/İçerik Üreticisi hesabı + Meta geliştirici uygulamasıyla | Şimdilik CSV ile; sonraki adım: Meta API |
| **TikTok** | Resmî API vermiyor | Bireysel hesaplar için yorum okuma API'si yok | CSV ile (yorumlardan elle ya da katılım formuyla) |

Bu yüzden oyunun girişi **yorum**dur: "Takip et, yoruma adını yaz, karakterin doğsun." Hem platformların kurallarına
uygun, hem de etkileşimi artırır (algoritma yorumu sever).

## 1. adım (hazır): CSV ile içe aktarma

1. `veri/girdi/` klasörüne bir ya da birkaç CSV koy. İlk satır başlık:

   ```csv
   platform,kullanici,ad
   instagram,@kopuz_okcu,Kopuz Okçu
   tiktok,ayaz_kiz,
   youtube,@demirdavul,Demir Davul
   ```

   - `platform`: `instagram`, `tiktok` ya da `youtube`
   - `kullanici`: kullanıcı adı (`@` olsa da olmasa da olur)
   - `ad`: görünen ad (boş bırakılabilir)
   - Excel'de hazırlıyorsan "CSV UTF-8" olarak kaydet (Türkçe harfler bozulmasın).

2. Önce ne olacağına bak (hiçbir şey yazmaz):

   ```powershell
   npm run takipci:ekle -- --kuru
   ```

3. Uygula:

   ```powershell
   npm run takipci:ekle
   ```

   - Yeni kişi → Kutada'da, Kut Kapısı'nın önünde yeni karakter (sınıfı platformundan).
   - Haritada olan biri başka platformdan da geldiyse → o platform eklenir, çift iz / oba öncülüğü rozeti ve nadirlik
     bonusu kendiliğinden verilir.
   - Geçersiz kullanıcı adları atlanır ve listelenir.

4. **İlk gerçek yayından önce bir kez** örnek (sahte) 300 takipçiyi sil:

   ```powershell
   npm run takipci:ekle -- --sifirla
   ```

   Akın listelerinden ve yer adlarından artık olmayan kişiler de temizlenir.

5. Kontrol et ve yayına gönder: `npm run data:check`, sonra `npm run build` (Cloudflare'e gönderince site güncellenir).

`veri/girdi/` git'e girmez (kişisel veri).

## 2. adım (hazır, anahtar sende): YouTube yorumlarını otomatik çekmek

1. [Google Cloud Console](https://console.cloud.google.com/) → yeni proje → **APIs & Services → Library** →
   "YouTube Data API v3" → **Enable**.
2. **Credentials → Create credentials → API key**. Anahtarı **Restrict key** ile yalnızca "YouTube Data API v3"e kısıtla.
3. Proje klasöründe `.env.local` dosyası oluştur (git'e girmez):

   ```
   YOUTUBE_API_KEY=buraya-anahtar
   YOUTUBE_KANAL=OBA-tales
   ```

4. Çek ve ekle:

   ```powershell
   npm run youtube:yorumlar
   ```

   ```powershell
   npm run takipci:ekle
   ```

Son 10 videonun yorumları `veri/girdi/youtube-yorumlar.csv` dosyasına yazılır. Ücretsiz kota günde 10.000 birim; bu
komut bir çalıştırmada birkaç düzine birim harcar.

## 3. adım (sırada): Instagram yorumları

Instagram yorumlarını okumak için hesabın **İçerik Üreticisi ya da İşletme** hesabı olmalı ve bir Facebook sayfasına
bağlanmalı. Sonra Meta for Developers'ta bir uygulama açılır, uzun ömürlü bir erişim anahtarı alınır. Bunları sen
yaptığında (anahtarı `.env.local`'a koyarsın, bana yazmazsın) `npm run instagram:yorumlar` betiğini YouTube'daki gibi
kurarım.

## 4. adım (sırada): tam otomatik

Cloudflare Pages Functions + D1 veritabanıyla yorumlar saatte bir kendiliğinden çekilir, yeni gelenler siteye
yeniden derleme beklemeden düşer. Site yayına girdikten ve ilk hafta CSV ile oturduktan sonra kurmak en sağlıklısı.

## Kişisel veri notu

- Yalnızca herkese açık kullanıcı adı ve görünen ad kullanılır; başka bilgi tutulmaz.
- Hedef kitle çocuklar da olduğu için: haritadan çıkmak isteyen olursa kaydını `roster.json`'dan silmek yeterli.
  Bunu sitede ve video açıklamalarında belirtmek iyi olur ("haritadan çıkmak istersen yaz").
- Kullanıcı adını video ya da haritada göstermek için platformların kurallarına uygun davran (yorum yapan kişi
  zaten herkese açık yazmıştır; yine de istemeyenin isteğine hemen uy).
