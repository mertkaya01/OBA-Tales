# Görsel geliştirme rehberi

Haritayı ve karakterleri daha net, daha güzel yapmak için kolaydan zora dört yol var. Hepsini kendin yapabilirsin;
her değişiklikten sonra `npm run dev` açıkken tarayıcı sayfayı kendiliğinden yeniler.

| Seviye | Ne yaparsın | Gereken |
|---|---|---|
| 1 | Hazır ayarların sayısını değiştir (netlik, renk, boyut) | Yalnızca VS Code |
| 2 | Kodla çizilmiş 3D karakter parçalarını değiştir, yenisini ekle | Biraz kod okuma |
| 3 | 2D piksel portreleri ve boss resimlerini değiştir | Harf ızgarası düzenleme |
| 4 | Kendi 3D modellerini Blender'da yap | Blender kiti (modeller/), yükleyici hazır |

Deneme adresleri: `/?saat=21` (gece), `/?saat=12` (öğle), `/?boss=ayazkurt` (başka boss'un meydanı, yalnızca
geliştirmede), `/?stres` (5000 kişi, performans denemesi).

---

## Seviye 1: hazır ayarlar

Dosyayı aç, sayıyı değiştir, kaydet. Beğenmezsen eski sayıya dön.

| Ne | Dosya | Şu an | Ne olur |
|---|---|---|---|
| **Piksel netliği** | `src/world3d/WorldView.tsx` → `PIXEL_SIZE` | 2 (her ekranda; eskiden masaüstünde 3) | **En etkili ayar.** 3 daha "retro", 1 piksel efektini tamamen kaldırır (tam çözünürlük). Sayı küçüldükçe ekran kartı daha çok çalışır |
| Reel Stüdyosu netliği | `src/pages/StudioPage.tsx` → `pixelSize={2}` | 2 | 1 yaparsan videolar daha keskin olur |
| **Renk basamağı** | `src/world3d/PixelPipeline.tsx` → `levels = 16` | 16 (eskiden 12) | 24: geçişler daha da yumuşar, noktalı titreme (dither) neredeyse kaybolur. 8–12: daha "retro" |
| Mürekkep kontur | `src/world3d/PixelPipeline.tsx` → `uInkStrength.value = 0.3 + 0.55 * …` | 0,3 → 0,85 | İkinci sayıyı küçült: konturlar incelir. Büyüt: çizgi film gibi kalın kontur |
| Renk canlılığı | `src/world3d/living/sky.ts` → `saturation` değerleri | 1,12 (gündüz) | 1,25: daha canlı, 1,0: doğal |
| **Karakter boyu** | `src/world3d/characters/instanceData.ts` → `CHARACTER_SIZE` | 1,8 (eskiden 1,6) | 2,0: daha da iri. Büyütürsen `src/world3d/living/raid.ts` → `COLUMN_SPACING` (4,9) ve `ROW_SPACING` (5,8) sayılarını da aynı oranda büyüt, yoksa akın safında karakterler birbirine girer |
| Ağaç boyu | `src/world3d/Nature.tsx` → `TREE_SIZE` | 1,35 | Küçültürsen karakterler öne çıkar |
| Arazi ayrıntısı | `src/world3d/terrainGeometry.ts` → `MESH_STEP` | 5 | 3: tepeler daha yumuşak ve ayrıntılı (daha çok üçgen) |
| En yakın yakınlaşma | `src/world3d/worldScale.ts` → `MAX_WORLD_ZOOM` | 22 | 30: sokak seviyesine daha çok inilir |
| Kamera eğimi | `src/world3d/worldScale.ts` → `MAX_TILT` | 0,92 radyan | Büyütürsen yakında daha yandan bakar |
| Arazi ve deniz renkleri | `src/game/palette.ts` → `TERRAIN_COLORS` | `grassLow: "#6f9a5a"` vb. | Herhangi bir renk kodu (`#rrggbb`) |
| Sınıf ve nadirlik renkleri | `src/game/palette.ts` → `CLASS_CLOTH`, `RARITY_COLORS` | | Karakterlerin kıyafet renkleri buradan gelir |
| Gece ve gündüz ışığı | `src/world3d/living/sky.ts` → `NIGHT` ve `KEYS` | | Gecenin aydınlığı: `lightIntensity` ve `hemiIntensity` |

Piksel boyu 2, renk basamağı 16 ve karakter boyu 1,8 uygulandı (5000 karakterde kare süresi 1–2 ms).

### Harita ayarları

Dünya 3200 × 2240 birim: ortada Kutada (Kut Kapısı), batıda 5 bölgeli ana ada, doğuda Pusluada ve 8 yabani ada.
Arazi her açılışta `world.json` → `seed` tohumundan arka planda üretilir (aynı tohum hep aynı adaları verir).

| Ne | Dosya | Ne olur |
|---|---|---|
| **Adaların şekli** | `src/content/regions.ts` (bölgeler), `src/content/islands.ts` (yabani adalar) → `polygon` noktaları | Noktaları taşı: ada büyür, küçülür, şekil değiştirir. Kıyı bu çizginin çevresinde kendiliğinden dalgalanır |
| Yeni yabani ada | `src/content/islands.ts` | Yeni bir kayıt ekle (arazi türü: `buzul`, `orman`, `kayalik`, `yuksek_ada`…). Kimliğini `src/types/world.ts` → `PLACE_IDS` ve `src/content/places.ts` listesine de yaz |
| **Farklı bir harita** | `public/data/world.json` → `seed` | Başka bir sayı yaz: aynı adalar ama bambaşka kıyılar, dağlar ve nehirler |
| Koy derinliği, burun boyu | `src/game/terrain.ts` → `COAST_IN` (95), `COAST_OUT` (44) | Büyüt: daha girintili çıkıntılı kıyı. `PROTECT_DEPTH` (55) bölge kenarından içeride kıyının asla giremeyeceği derinlik |
| Nehir sayısı | `src/game/terrain.ts` → `RIVER_MIN_FLOW` | 900. Küçült (600): daha çok, daha uzun nehir. Büyüt (1400): daha az |
| Doğal göller | `src/game/terrain.ts` → `LAKE_DEPTH`, `LAKE_MIN_CELLS` | Küçült: dağlarda daha çok küçük göl |
| Kazılmış göller | `src/content/sites.ts` → `BASINS` | Ayna Göl ve Yeşilsırt gölü. Yeni çukur ekle: orada göl oluşur |
| **Obalar** | `src/content/sites.ts` → `VILLAGES` | 14 oba: yer, çadır sayısı, sancak rengi, at ağılı. Takipçiler kendi bölgelerinin obalarına yerleşir (`npm run data:gen` sonrası) |
| Anıtlar | `src/content/sites.ts` → `MONUMENTS` | Ata Heykeli, Balbal Yolu, Yazıtlı Taşlar, Kartal Anıtı, Dilek Ağacı, gözcü kuleleri, Üçkardeş Feneri, batık gemi, donmuş şelale. Şekilleri `src/world3d/Settlements.tsx` içinde |
| Akın meydanları | `src/content/sites.ts` → `RAID_GROUNDS` | Düz, ağaçsız ve nehirsiz tutulur (`npm test` denetler) |
| **Kut Kapısı** | Konum: `src/content/sites.ts` → `LANDMARKS.kutKapisi`; görünüm: `src/world3d/Portal.tsx` | Girdabın renkleri `VORTEX_FRAGMENT` içindeki `gold`, `ice`, `violet`; varış halkasının sıklığı `PULSE_PERIOD` (5 sn) |
| Yelkenliler | `src/content/sites.ts` → `SEA_ROUTES` | Elips biçimli deniz yolları: merkez, genişlik, tekne sayısı, hız. Yol açık suda kalmalı (`npm test` denetler) |
| Kıyı dalgaları | `src/world3d/shaders/ocean.ts` → `bands` ve `foam` | `shore * 5.0`: dalga sıklığı, `uTime * 0.22`: hızı |
| Çayır otları ve çiçekler | `src/world3d/layout.ts` → `scatterTufts`, `src/world3d/Details.tsx` → `TUFT_ZOOM` | Yoğunluk, çiçek oranı ve renkler; otlar yalnızca yakınlaşınca çizilir |
| Yer adları | `src/content/places.ts` | Ad konmamış yerlerin haritacı adı. Takipçinin koyduğu ad `world.json` → `namedPlaces` içine yazılır |
| Deniz ve harita renkleri | `src/game/palette.ts` → `shoal`, `shelf`, `shelfDeep`, `openSea`, `river`, `lake`, `trail`… | Sığlık şeritleri, nehirler, göller, patikalar |
| 2D harita tarama çizgileri | `src/game/terrainPaint.ts` → "Harita üslubu" bölümü | Yalnızca Leaflet haritasında; 3D dokusu sade kalır |

Değişiklikten sonra `npm test` çalıştır: meydanların, obaların ve yapıların karada ve kuru kaldığını, patikaların her
obaya ulaştığını denetler. Bölge ya da oba konumu değiştiyse `npm run data:gen` ile takipçileri yeniden yerleştir.

---

## Seviye 2: 3D karakter parçaları

Bütün takipçiler `src/world3d/characters/characterKit.ts` dosyasındaki parçalardan kurulur. Her parça basit bir
geometrik şekildir; yaklaşık 60 parça tanımlı, her karakter kendine uyanları taşır.

**Bugün bir karakterde neler var:**
- **Gövde:** çizmeli bacaklar, yakalı kaftan (yaka nadirlik renginde), kemer ve altın toka, etek bandı (destansı ve efsanevide altın), kollar ve eller, atkı.
- **Yüz:** göz, kaş, burun; bıyık, kısa ya da uzun sakal.
- **Saç:** kısa, uzun, topuz; perçem ya da omuzlara inen örgüler.
- **Başlık:** tolga (miğfer; destansı ve efsanevide tüylü), ak börk, kürk kalpak, keçe külah; efsanevide başlık yoksa altın taç.
- **Kalkaneri:** yarı öne dönük yuvarlak kalkan (kabara ve çember), balta ya da kılıç, kürk yaka, omuzluk.
- **Okyeli:** tüylü başlık, gözlük, fildişi yay ve kiriş, sırtta okluk ve oklar.
- **Ocakcan:** sırt davulu, elde fener, bazılarında kopuz, yumuşak pelerin.
- **Nadirlik:** destansı ve efsanevide uzun pelerin ve madalyon; efsanevide pelerinde parlayan runlar.
- **Kadro:** Baturay tüylü tolgalı ve kılıçlı; Dede Toygar uzun sakallı ve parlayan taşlı asalı.

**Kim neyi takar:** `kitChoice` takipçinin kimliğinden başlık, sakal, perçem, örgü, silah ve kopuz seçer. Aynı takipçi hep
aynı görünür, iki takipçi neredeyse hiç aynı olmaz. Oranları değiştirmek için `kitChoice` içindeki sayılara bak
(ör. Kalkaneride `hatRoll < 3 ? "tolga"`: onda üçü tolgalı). Kadronun görünüşü `CAST_KIT` içinde.

**Hareket:** `legs: true` parçalar yürürken kalçadan, `arms: true` parçalar (kollar ve elde tutulan her şey) omuzdan
sallanır; akın meydanında Oba Narası'nda kollar havaya kalkar. Yeni bir eşyayı karakterin eline vereceksen `arms: true`
yaz, kolla birlikte oynar.

**Koordinatlar:**
- Karakterin ayak tabanı `(0, 0, 0)` noktasında, yüzü `+z` yönünde (kameraya doğru).
- Boyu yaklaşık 4,4 birim: bacaklar 0–1, gövde 1–2,75, kafa 2,95–3,95. Omuz eklemi `(±0,82, 2,62)`, eller `y = 1,43`.
- `x` sağa, `y` yukarı.

**Şekil yardımcıları:**

```ts
box(genişlik, yükseklik, derinlik, { at: [x, y, z], rx, ry, rz })   // kutu, rx/ry/rz = döndürme (radyan)
cylinder(üstYarıçap, altYarıçap, yükseklik, kenarSayısı, { at: [...] })
cone(yarıçap, yükseklik, kenarSayısı, { at: [...] })
ico(yarıçap, { at: [...] })                                          // yuvarlak taş, düğme gibi
pair(g, y, d, x, y, z)                                               // sağ-sol eş parça (göz, kaş, omuzluk)
merge(parça1, parça2, …)                                             // birden çok şekli tek parça yap
```

**Örnek: Okyelilere kemerde bıçak eklemek**

1. Geometriyi tanımla (Okyeli bölümüne):
   ```ts
   const KNIFE = merge(box(0.1, 0.6, 0.05, { at: [-0.75, 1.45, 0.6], rz: 0.3 }), box(0.14, 0.22, 0.12, { at: [-0.68, 1.75, 0.6], rz: 0.3 }));
   ```
2. `PARTS` listesine ekle:
   ```ts
   { id: "bicak", geometry: KNIFE, applies: isClass("okyeli"), color: (l) => l.colors.M, detail: true },
   ```

**Parça ayarları:**
- `applies`: kimde görünür. Sınıfa, nadirliğe, saça ya da `kitChoice` seçimlerine göre (`has((k) => k.hat === "bork")`).
- `color`: rengi. `l.colors.X` harfleri 2D portredeki renk yuvalarıdır; listesi `src/game/sprites/composeSprite.ts` → `resolveLook` içinde.
- Uzaklık kademesi: `core: true` en uzaktan bile çizilir, işaretsiz parçalar orta mesafeden, `detail: true` yalnızca yakından.
  Eşikler `src/world3d/FollowerInstances.tsx` → `SILHOUETTE_ZOOM` (1,1) ve `DETAIL_ZOOM` (2,4).
- `glow: true`: kendi ışığıyla parlar. `shadow: true`: gölge düşürür. `legs` / `arms`: bacakla ya da kolla birlikte hareket eder.

Yeni bir şey eklemek yerine var olanı değiştirmek istersen, mesela kafayı büyütmek için:
`const HEAD = box(1.1, 1.0, 1.0, …)` satırındaki sayıları değiştir.

**Kontrol:** `npm test` çalıştır. `characterKit.test.ts`, parçaların karakterin sınırları içinde kaldığını denetler.

Boss'lar `src/world3d/living/bossModels.tsx` (Karaçay, Ayazkurt, Kışgölgesi Han) ve
`src/world3d/living/RaidGround.tsx` (Buzkıran Tekgöz) içinde. Aynı yöntemle kurulmuşlar, React bileşeni olarak:
`<mesh position={[x, y, z]}><boxGeometry args={[g, y, d]} /></mesh>`.

---

## Seviye 3: 2D piksel resimler

**Portreler ve harita pinleri:** `src/game/sprites/pixelMaps.ts`

- Her karakter 16 × 20 piksellik katmanlardan oluşur.
- Her satır 16 harflik bir metin: `.` boş, harf de bir renk yuvası (`s` ten, `h` saç, `c` kıyafet, `k` kemer, `o` kontur…).
- Katmanlar üst üste biner: gövde, saç, sınıf ekipmanı (`CLASS_LAYERS`), nadirlik süsleri (`RARITY_LAYERS`).

Bir harfi değiştirince o piksel değişir. Kartlar, çekmece ve 2D harita pinleri anında güncellenir.

**Boss resimleri (sezon sayfası, akın provası):** `src/game/fx/bossSprites.ts`
- `PixelCanvas` ile kodla çizilir: `rect`, `ellipse` (üç tonlu ışık), `tri`, `disc`, `line`; sonunda `outline()` mürekkep kontur ekler.
- Her boss'un bir de sakin hâli var (`calm`).

**Paylaşım görseli:** `scripts/generate-og.ts`. Değiştirdikten sonra `npm run og` çalıştır.

---

## Seviye 4: kendi 3D modellerin

En büyük kalite sıçraması burada.

**Program önerisi:**
- **[Blockbench](https://www.blockbench.net)** (ücretsiz): kutularla low-poly karakter yapmak için en kolayı, bu oyunun tarzına çok uygun.
- **[Blender](https://www.blender.org)** (ücretsiz): her şeyi yapar ama öğrenmesi uzun sürer.
- Hazır model kullanacaksan yalnızca **CC0** ya da açık lisanslı modeller kullan (ör. Kenney, Quaternius). Başka oyunlardan model alma; OBA-Tales özgün kalmalı.

**Karakterler: Blender kiti (hazır, bağlı):** `modeller/OBA-Tales-karakter-kit.blend` haritadaki karakterlerin bütün
parçalarını içerir.
1. Bir parçayı Blender'da düzenle.
2. Dosyanın içindeki `OBA-Tales_oyuna_aktar.py` betiğini çalıştır (`Alt+P`) ya da `npm run blender:aktar` kullan.
3. Oyun `public/models/karakter-kit.glb` dosyasını görünce bütün takipçiler yeni şekille çizilir.

Renkler, sınıflar, seçenekler, uzaklık kademeleri ve hareketler koddaki kurallarla aynı kalır. Dosya yoksa koddaki
şekiller kullanılır. Adım adım anlatım ve kurallar [modeller/README.md](../modeller/README.md) içinde.
- Parça adları (`kafa`, `govde`, `kalkan` …) korunmalı.
- Karakter `-Y`'ye bakar, boyu 4,4 m.
- Kollar omuzdan, bacaklar kalçadan döner.
- Tek parça en fazla 350 üçgen, bir karakter toplamda en fazla 1500 üçgen.

Ölçüleri ve değişen parçaları denetlemek için `npm run blender:kontrol` kullan.

**OBJ kalıpları:** Blockbench gibi öteki programlar için aynı karakterler `modeller/referans/` içinde OBJ olarak duruyor
(`npm run modeller`). Blockbench'te yapılan parça OBJ olarak Blender kitine alınıp oradan aktarılır.

**Kurallar (yeni modeller için):**
- Dışa aktarım biçimi **GLB** (glTF binary).
- **Boss:** Tek parça olabilir, kendi renkleri ve dokusuyla. Yüzü `+z` yönünde (Blender'da `-Y`), ayaklar yerde.
- **Kadroya özel model:** Baturay, Dede Toygar gibi kadro üyelerine özel modeller.
- Boss ve kadro modellerinin yükleyicisi bir sonraki adım. İlk modelin hazır olunca `public/models/` klasörüne koy;
  meydana ya da kahramanın yerine ben bağlarım.

---

## Değişiklikten sonra kontrol

```powershell
npm run dev
```

Tarayıcıda bak, sonra:

```powershell
npm test
```

```powershell
npm run build
```

Bir şey bozulursa `npm test` hangi dosyada olduğunu söyler. Geri almak için değiştirdiğin sayıyı eski hâline getirmen yeter.
