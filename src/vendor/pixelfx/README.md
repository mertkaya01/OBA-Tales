# pixelfx (vendor)

Kodla çizilmiş piksel efektleri: <https://github.com/patch-gg/pixelfx>

- **Commit:** `5294518ce7c72e48b6100a744596e0acf57f2826` (sürüm 0.3.1)
- **Lisans:** MIT, `LICENSE` ve `NOTICE.md` dosyalarına bakın (Patch, Hugo Duprez / Sprite Fusion, Hollow Crown).
- **Neden npm değil:** npm 12, GitHub'dan paket kurmayı varsayılan olarak engelliyor (EALLOWGIT). Bu güvenlik
  ayarını gevşetmek yerine, pixelfx README'sinin önerdiği gibi `src/core` ve kullandığımız efektler kopyalandı.

## İçerik

| Klasör | Ne | Değiştirildi mi? |
|---|---|---|
| `core/` | pixelfx çekirdeği (`src/core`, 15 dosyanın hepsi) | Hayır, upstream ile birebir |
| `fx/<kategori>/` | Kullandığımız efektler ve kategori kütüphaneleri (`_lib.js`) | Hayır, upstream ile birebir |
| `effects.js`, `effects.d.ts`, `core/index.d.ts` | OBA-Tales sitesinin kayıt dosyası ve TypeScript bildirimleri | Bizim dosyalarımız |

Kullanılan efektler: fire/spirit-flame, fire/campfire, holy/halo, holy/heal, holy/sunburst, ice/frost-nova,
ice/ice-shatter, ice/ice-crystal, ice/frost-breath, weather/snow, weather/blizzard,
weather/aurora, weather/fog, weather/fireflies, shadow/eclipse, shadow/shadow-flames, ui/confetti, impacts/shield-block, projectiles/arrow.

İndirilen dosyalar ağ isteği, `eval`, çerez ve depolama erişimi için tarandı; hiçbiri yok. Efektler yalnızca
`core/` ve kendi kategorilerinin `_lib.js` dosyasını kullanır.

## Yeni efekt eklemek

1. Upstream'den aynı commit'teki dosyayı (ve gerekiyorsa kategorinin `_lib.js` dosyasını) `fx/<kategori>/` altına kopyala.
2. `effects.js` ve `effects.d.ts` dosyalarına kimliğini ekle.
3. OBA-Tales sitesindeki kullanım yeri: `src/game/fx/fxCatalog.ts`.

Upstream'i güncellerken commit'i bu dosyada değiştir ve dosyaları birlikte yenile.
