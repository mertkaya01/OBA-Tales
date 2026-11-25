# OBA-Tales · Topluluk Akın Haritası

> Buzlu rüzgâr eser, oba omuz omuza verir; her takipçinin izi bu destanda yaşar.

Takipçilerin harita üzerinde karakter olarak yaşadığı, 12 bölüm ve 4 boss akınıyla ilerleyen, çocuk dostu bir
topluluk RPG sitesi. Takip edilen platform sınıfı belirler (Instagram → Kalkaneri, TikTok → Okyeli, YouTube →
Ocakcan), yorumlardaki oylar hikâyeye yön verir.

## Sayfalar

| Adres | İçerik |
|---|---|
| `/` | Akın haritası: 3D piksel diorama dünya (Three.js) ya da 2D harita (Leaflet), süzgeçler, karakter çekmecesi, akın paneli |
| `/karakterler` | Oba kadrosu, nadirlik dizini, bütün yoldaşlar |
| `/bolumler` | Sezon: 12 bölüm, oylama sonuçları, Dede Toygar'ın özetleri, boss kartları |
| `/katil` | Obaya katılma rehberi, sınıflar, nadirlik ve rozetler, "kahramanını bul" önizlemesi |
| `/studyo` | Reel Stüdyosu: dünyadan dikey (9:16) video, menüde yok, sayfa altından açılır |

## Reel Stüdyosu

Dünyayı sinematik kamerayla çekip Instagram Reels ve TikTok için video üretir.

1. `/studyo` adresini aç ve bir şablon seç:
   - **Bölüm tanıtımı:** adalardan akın meydanına iner, ordunun etrafında döner, boss'u gösterir, sonunda oylama kartı açılır.
   - **Obaya katıl:** akşam ışıklarında oba; "Sınıfını seç" ve "Çift iz" kartları.
   - **Kahraman yakın çekimi:** kullanıcı adını yazdığın yoldaşı takip eden kamera ve tanıtım kartı.
2. Gün saatini, havayı, altyazıları (her satır kelime kelime belirir) ve imzayı ayarla.
3. **Önizle** ile izle, **Kaydet ve indir** ile 1080 × 1920 videoyu indir. Güncel Chrome, Edge ve Safari MP4, diğerleri WebM üretir.
   **Kapak indir** o anki kareyi PNG olarak verir.

Kayıt tamamen tarayıcıda yapılır, hiçbir şey sunucuya gönderilmez. Kayıt sırasında sekmeyi açık tut; arka plandaki sekmede
tarayıcı kareleri yavaşlatır.

## Geliştirme

Node 24 ve npm gerekir.

```powershell
npm install
```

```powershell
npm run dev
```

Ardından tarayıcıda `http://localhost:5173` adresini aç.

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm test` | Bütün testler (Vitest) |
| `npm run lint` | Kod denetimi (oxlint) |
| `npm run data:check` | `public/data/*.json` dosyalarını şemaya ve içeriğe göre denetler (derlemeden önce kendiliğinden çalışır) |
| `npm run data:gen` | Deneme takipçi listesi üretir (`public/data/roster.json`) |
| `npm run data:gen:stress` | 5000 kişilik performans verisi; geliştirmede `/?stres` ile açılır, yayına girmez |
| `npm run og` | Paylaşım görselini (`public/og-image.png`) yeniden çizer |
| `npm run build` | Yayın derlemesi (`dist/`) |
| `npm run preview` | Derlemeyi yayındaki güvenlik başlıklarıyla (`public/_headers`) yerelde açar |

Geliştirme ipuçları: `/?saat=21` günün saatini sabitler (gece, gün batımı denemek için), `/?stres` 5000 kişilik
veriyi açar.

## Canlı veriyi güncellemek

Kod değiştirmeden güncellenen üç dosya var. Değiştirip yayına gönderdiğinde site bir dakika içinde yenilenir.

**`public/data/roster.json`: takipçiler.** Her kayıt bir karakter: `id`, `handle`, `platform`, `linkedPlatforms`,
`rarity`, `region`, `coordinates` (bölgenin içinde olmalı), `badges`… `npm run data:check` hataları Türkçe anlatır.

**Yeni aboneler Kut Kapısı'ndan gelir.** Yeni takipçiyi `"region": "kutada"` ve Kut Kapısı'nın çevresinde bir
koordinatla ekle (kapı: `x 1600, y 1105`; meydanın dışında, ör. `x 1600, y 1135`). Haritada portalın önünde durur;
portal etiketi kaç yeni yoldaş olduğunu söyler. İlk akınından sonra kaydının `region` ve `coordinates` alanını kendi
obasına taşı (oba konumları `src/content/sites.ts` → `VILLAGES`).

**`public/data/season.json`: sezon.**

- `activeEpisode`: aktif bölüm.
- Her bölümde `status` (`kilitli`, `yakinda`, `aktif`, `tamamlandi`) ve `participantIds` (akındakiler) var.
- `results` oy sayılarını tutar. `winnerOptionId` boş kaldıkça oylama sürüyor görünür.
- `airedAt` yayın tarihi, `recap` Dede Toygar'ın bölüm sonu özeti.

**`public/data/world.json`: dünya.**

- `revealedRegions`: sisten çıkan bölgeler.
- `weather`: `acik`, `kar` ya da `tipi`.
- `namedPlaces`: topluluğun ad koyduğu yerler, ör. `{ "place": "fener", "name": "Yıldızgözü Feneri", "namedBy": "kopuz_okcu55" }`. `namedBy` obadaki bir karakterin kimliği olmalı.
- `socialLinks`: Obaya Katıl sayfasındaki takip düğmeleri; yalnızca `https://` adresleri.

## Gerçek takipçiler ve yayına giriş

- Hesapları haritaya bağlamak (CSV içe aktarma, YouTube yorumları, sıradaki adımlar): [docs/hesaplar.md](docs/hesaplar.md)
- Video sırası, açıklamalar ve haftalık döngü: [docs/yayina-giris.md](docs/yayina-giris.md)
- Kendi modellerin için karakter kalıpları (OBJ): [modeller/README.md](modeller/README.md)

## Yayına alma (Cloudflare Pages)

1. Projeyi bir GitHub deposuna gönder.
2. Cloudflare panelinde **Workers & Pages → Create → Pages → Connect to Git** ile depoyu seç.
3. Ayarlar:
   - **Framework preset:** None (ya da Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node sürümü `.node-version` dosyasından okunur (24).
4. Proje adın `oba-tales` değilse ya da kendi alan adını bağlarsan `.env` içindeki `VITE_SITE_URL` değerini
   güncelle (paylaşım kartlarındaki görsel bağlantısı buradan kurulur).

Git kullanmadan da yayınlanabilir: `npm run build` sonrası `dist/` klasörü Cloudflare panelinde **Upload assets**
ile yüklenir.

Yayında olanlar:

- `public/_headers` dosyasındaki güvenlik başlıkları (CSP, çerçeveleme yasağı) ve önbellek kuralları uygulanır. Derleme çıktıları bir yıl önbellekte kalır, `data/*.json` dosyaları bir dakikada yenilenir.
- `/karakterler` gibi adresler doğrudan açılabilir. Cloudflare Pages, `404.html` olmadığı için bilinmeyen adresleri `index.html`'e yönlendirir.

## Mimari kısaca

```
public/data/*.json ─► src/data (fetch + zod) ─► src/state (zustand ↔ URL) ─┬─► world3d/  Three.js dünya
src/content/*  kanon: sınıflar, bölgeler, adalar, obalar, boss'lar, kadro ──┤─► map2d/    Leaflet harita
src/lib/*      saf kurallar: filtre, sezon, kadro (testli) ──────────────────┤─► pixi/      PixiJS + pixelfx
src/game/*     motordan bağımsız sanat: arazi, sprite, efekt kataloğu ──────┘─► pages/ + components/
```

**Dünya.** 3200 × 2240 birimlik takımada. Tam ortada Kutada ve Kut Kapısı (yeni aboneler buradan gelir); batısında
5 bölgeli ana ada (Batı Kemeri ile bağlı), doğusunda Pusluada (Kadim Kemer ile bağlı), çevrede adlarını topluluğun
koyacağı 8 yabani ada.
Arazi (kıyılar, sığlıklar, dağ sırtları, nehirler, göller, patikalar) `world.json` tohumundan açılışta bir Web
Worker'da üretilir (`src/game/terrain.ts`, `paths.ts`, `terrain.worker.ts`). Kıyı dalgaları, yelkenliler, çayır otları
ve deniz kayaları `src/world3d/Details.tsx` ile `Ocean.tsx` içinde; portal `Portal.tsx`. Obalar, anıtlar ve akın meydanları
`src/content/sites.ts` içinde; takipçiler kendi bölgelerinin obalarında yaşar. Görsel ayarlar için
[docs/gorsel-rehber.md](docs/gorsel-rehber.md).

Ayrıntılar kodun içindeki açıklamalarda. Krediler ve lisanslar için [CREDITS.md](CREDITS.md).
