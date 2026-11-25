# OBA-Tales modelleri

## `referans/`: oyundaki karakterlerin çıktısı

Haritadaki low-poly karakterler kodla kurulur (`src/world3d/characters/characterKit.ts`). Bu klasördeki OBJ dosyaları
o karakterlerin birebir çıktısıdır: üzerine kendi modelini yapman için kalıp. Yeniden üretmek için:

```powershell
npm run modeller
```

| Dosya | Ne |
|---|---|
| `taban.obj` | Yalnızca ortak gövde (bacak, çizme, kaftan, kollar, eller, kafa, yüz, saç). En iyi başlangıç kalıbı |
| `kalkaneri.obj` | Tolgalı, kılıçlı, kalkanlı, kısa sakallı Kalkaneri |
| `kalkaneri-borklu-baltali.obj` | Börklü, baltalı, uzun sakallı Kalkaneri |
| `okyeli.obj` | Tüylü başlıklı, yaylı, okluklu Okyeli |
| `ocakcan.obj` | Kalpaklı, fenerli, kopuzlu, davullu Ocakcan |
| `efsanevi-ocakcan.obj` | Efsanevi nadirlik: uzun pelerin, altın etek, madalyon, runlar |
| `kadro-*.obj` | Yedi kahraman (Baturay, Dede Toygar, Alptuğ, Süheyla, Kürşat, Yalvaç, Işıkay) |
| `blockbench/` | Aynı dosyalar 10 kat büyük (boy ≈ 44 birim): Blockbench'te rahat çalışılır |

Her OBJ'nin yanında aynı adlı `.mtl` dosyası renkleri taşır; ikisini aynı klasörde tut.

**Ölçüler:** ayak tabanı `y = 0`, yüz `+z` yönünde (kameraya), boy ≈ 4,4 birim (blockbench sürümünde ≈ 44).
Omuz eklemi `x = ±0,82, y = 2,62`; eller `y = 1,43`.

## Blockbench'te açmak

1. Blockbench → **File → New → Generic Model**.
2. **File → Import → Import OBJ Model** → `modeller/referans/blockbench/kalkaneri.obj`.
3. Sol taraftaki **Outliner**'da her parça adıyla görünür (`govde`, `kafa`, `kalkan`…).
4. Kendi küplerini bunların üstüne ya da yerine kur. Kalıbı kilitlemek için parçaları seçip göz simgesiyle gizleyebilir
   ya da kilit simgesiyle kilitleyebilirsin.

## Blender'da açmak

**File → Import → Wavefront (.obj)** → bir OBJ seç. Parçalar ayrı nesneler olarak gelir, renkleri malzemelerdedir.

## Kendi modelini oyuna koymak için kurallar

- **Parça adlarını koru:** gövdenin adı `govde`, kafanın `kafa`, saçın `sac`, kalkanın `kalkan`… (tam liste OBJ'deki
  `o` satırları). Yükleyici parçaları adlarından tanır ve her takipçinin kendi rengini o parçaya verir.
- **Renklenecek parçalar ayrı nesne olsun.** Tek renkli bir parçayı birden çok nesneye bölebilirsin (`govde`, `govde-2`
  gibi aynı ön ekle).
- **Elde tutulanlar** (kalkan, kılıç, yay, fener, kopuz) karakterin sağında ya da solunda dursun: oyun onları o
  taraftaki kolla birlikte sallar.
- **Az çokgen:** karakter başına 600–1200 üçgen ideal; binlerce kopya çizilecek.
- Dışa aktarım: **GLB (glTF binary)**, dosyayı `public/models/` klasörüne koy (ör. `public/models/kalkaneri.glb`).
- Kadroya özel model yaparsan dosya adı kadro kimliği olsun: `baturay.glb`, `dede_toygar.glb`…

İlk modelini hazırladığında haber ver: GLB yükleyiciyi bağlayıp modelini haritaya koyarım.
