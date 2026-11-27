# Hesapları haritaya bağlamak

Hedef: Instagram, TikTok ve YouTube'daki gerçek takipçiler haritada karakter olarak yaşasın; yeni gelen Kut Kapısı'ndan
doğsun, yorumlar oylama olsun.

## Hikâyeyi ilerletmek (Yönetim paneli → Hikâye)

1. gün ada boştur. Kahramanlar sırayla gelir: **mhellingtr → egetunce → BinTaş**.

1. `npm run dev` ile paneli aç (http://localhost:5173/yonetim).
2. **Hikâye** kartında **Sıradakini getir** de. Geliş `public/data/world.json` → `story.arrivals` içine yazılır.
3. Commit ve push et. Sitede kahraman Kut Kapısı'ndan doğar; o hafta siteye giren herkes gelişi bir kez izler.
   Işık kahramanın o anki işinin başına iner (gece geldiyse çadırının kapısına; çıkıp selam verir, geri girer).

Gelen kahraman o andan itibaren İstanbul saatine göre yaşar: sabah odun, öğle toplama, ikindi av, akşam ateş başı,
gece 01–05 çadırında uyku. Ayrıntılar `docs/gorsel-rehber.md` → "Gün düzeni".

Yanlışlıkla getirdiysen **Son gelişi geri al**. Aynı kartta **Adaları aç / kapat** ile karartılı bir bölgeyi ya da
yabani adayı hikâyede açarsın: karartı kalkar, obaları, ağaçları ve iki yakası da açıksa köprüleri belirir.

## Yönetim paneli (önerilen yol)

```powershell
npm run dev
```

Tarayıcıda **http://localhost:5173/yonetim** adresini aç. Panel yalnızca senin bilgisayarında çalışır; yayındaki sitede
bu sayfa yoktur. Paneldeki bölümler:

| Bölüm | Ne yapar |
|---|---|
| Durum | Haritadaki takipçi sayısını, platform ve nadirlik dağılımını gösterir |
| Hikâye | Kahramanları sırayla getirir, hikâye gününü ve açık adaları ayarlar |
| Takipçiler | Listede ad, kullanıcı adı ya da unvanla arar; platform ve nadirliğe göre süzer. Birine tıklayınca düzenlersin: görünen ad, unvan (boşsa otomatik), ana platform (sınıfı belirler), bağlı platformlar, nadirlik (en çok Efsanevi), puan, rozetler ve haritadaki yeri (Kut Kapısı, bir oba ya da küçük haritada tıklanan nokta). "Yeni takipçi" ile tek kişi eklersin, "Sil" ile onaylayıp çıkarırsın |
| Bağlantılar | Instagram, TikTok, YouTube hesapların ve destek bağlantısı. Üst menüde görünür; destek bağlantısı boşsa düğme "yakında" der |
| Takipçi ekle (toplu) | Instagram ve TikTok veri dosyasını, YouTube yorumlarını, CSV'yi ya da elle yazılan listeyi okur. Önce önizleme gelir, sonra "Haritaya ekle" |
| Haritadan çıkar | Çıkmak isteyen kişiyi kullanıcı adıyla siler |
| Sıfırla | Örnek takipçileri siler; kadro ve özel kahramanlar kalır. Kutuya "SIFIRLA" yazınca çalışır |
| Kontrol et ve yayına al | Veri denetimini çalıştırır, yayına alma komutlarını gösterir |

Düzenlemede kurallar sunucuda denetlenir: denize, dereye, çadırın içine ya da karanlıktaki bir adaya taşıma reddedilir;
kullanıcı adı değişmez (yanlışsa silip yeniden ekle). Kurallar `scripts/lib/followerEdit.ts` içinde.

**Takipçi listesi temelli yol:** Platformların API'si takipçi listesi vermez, ama hesap sahibi kendi verisini indirebilir.
Dosya tarayıcıda okunur; yalnızca kullanıcı adları kaydedilir.

- **Instagram:**
  1. Profil → ☰ → Hesap Merkezi → Bilgilerin ve izinler → Bilgilerini indir.
  2. "Bilgilerinin bir kısmı" → Takipçiler ve takip edilenler → Cihaza indir. Biçim JSON, tarih aralığı Tüm zamanlar.
  3. Gelen ZIP'teki `connections/followers_and_following/followers_1.json` dosyasını panelden seç.
- **TikTok:**
  1. Profil → ☰ → Ayarlar ve gizlilik → Hesap → Verilerini indir → JSON → Veri iste. Hazırlanması birkaç gün sürebilir.
  2. ZIP'teki `user_data_tiktok.json` dosyasını panelden seç. TXT seçtiysen `Follower List.txt` dosyasını seç.
- **YouTube:** Abone listesinin tamamı alınamaz.
  - YouTube Studio → Pano → "Son aboneler" listesinde yalnızca aboneliğini herkese açık yapanlar görünür. Oradaki adları
    bir metin dosyasına alt alta yazıp panelden seçebilirsin.
  - Ya da aşağıdaki API anahtarıyla yorum yapanları "Yorumlardan çek" ile alabilirsin.

Haftada bir yeni dosya indirip panelden eklemen yeterli: zaten haritada olanlar atlanır, yeniler Kut Kapısı'nın önünde
doğar. Aynı komutlar komut satırında da var: `npm run takipci:ekle` (`veri/girdi/` içindeki CSV, JSON, HTML ve TXT
dosyalarını okur) ve `npm run takipci:ekle -- --cikar kullanici1,kullanici2`.

Paneldeki değişiklikler `public/data/` içine yazılır. Yayına almak için:

```powershell
git add public/data
```

```powershell
git commit -m "Takipçiler güncellendi"
```

```powershell
git push
```

## Önce gerçek durum: platformlar ne veriyor?

| Platform | Takipçi listesi | Yorumlar | Ne yapıyoruz |
|---|---|---|---|
| **YouTube** | Resmî API vermiyor; Studio'da yalnızca herkese açık aboneler görünür | **Veriyor**: herkese açık yorumlar, ücretsiz API anahtarıyla | Yorum yapanlar otomatik çekilir (`npm run youtube:yorumlar`) |
| **Instagram** | Resmî API vermiyor, ama **"Bilgilerini indir" dosyasında var** (panelden yüklenir) | Kendi gönderinin yorumları, yalnızca İşletme/İçerik Üreticisi hesabı + Meta geliştirici uygulamasıyla | Şimdilik CSV ile; sonraki adım: Meta API |
| **TikTok** | Resmî API vermiyor, ama **"Verilerini indir" dosyasında var** (panelden yüklenir) | Bireysel hesaplar için yorum okuma API'si yok | CSV ile (yorumlardan elle ya da katılım formuyla) |

Bu yüzden ana yol **takipçi listesi dosyası**dır (yukarıdaki panel); yorumlar oylama, ad koyma ve YouTube için yardımcı yoldur.

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
