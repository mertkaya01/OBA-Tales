# Krediler

OBA-Tales özgün bir masaldır: bütün karakterler, yerler, boss'lar ve görseller bu proje için kodla üretilmiştir
(görsel dosyası yok; piksel sanatı, ada ve 3D modeller koddan çizilir). Aşağıdaki açık kaynak projeler sayesinde
mümkün oldu.

Yayındaki sitede lisans metinleri şu adreslerde durur:

- `/lisanslar/ucuncu-taraf.txt`: paketlenen bütün npm bağımlılıkları (Vite derlemede otomatik üretir)
- `/lisanslar/pixelfx.txt`: pixelfx'in MIT lisansı ve atıfları

## Kod ve efektler

| Proje | Lisans | OBA-Tales sitesinde ne işe yarıyor |
|---|---|---|
| [pixelfx](https://github.com/patch-gg/pixelfx) (Patch) | MIT | Canlı portre auraları ve boss akını sahnesindeki piksel efektler. `src/vendor/pixelfx` altında, commit `5294518`, değiştirilmeden |
| Sprite Fusion pixel art VFX (Hugo Duprez) | MIT | pixelfx'in simülasyon çekirdeği (`core/sim.js`) ve bazı efektleri bunu uyarlar (pixelfx `NOTICE.md`) |
| [Hollow Crown](https://github.com/rehan-remade/hollow-crown) (rehan-remade) | MIT | pixelfx'in hareket zamanlaması (`core/act.js`) bunu uyarlar (pixelfx `NOTICE.md`) |
| [sloemo01/diorama](https://github.com/sloemo01/diorama) | MIT | Teknik ilham: düşük çözünürlük, renk basamakları, Bayer titreme, mürekkep kontur sırası. Shader'lar OBA-Tales için sıfırdan yazıldı, kod alınmadı |
| [SandroMaglione/inkline-town](https://github.com/SandroMaglione/inkline-town) | Apache-2.0 | İlham: tohumdan ada üretimi ve her şeyi kodla çizme yaklaşımı. Kod alınmadı |

## Motorlar ve kütüphaneler

| Paket | Lisans |
|---|---|
| [React](https://react.dev), React DOM | MIT |
| [React Router](https://reactrouter.com) | MIT |
| [three.js](https://threejs.org) | MIT |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [drei](https://github.com/pmndrs/drei) | MIT |
| [PixiJS](https://pixijs.com) | MIT |
| [Leaflet](https://leafletjs.com) | BSD-2-Clause |
| [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) | MIT |
| [React Leaflet](https://react-leaflet.js.org) | Hippocratic License 2.1 (insan haklarına uygun kullanım koşulu olan etik bir lisans) |
| [zustand](https://github.com/pmndrs/zustand) | MIT |
| [zod](https://zod.dev) | MIT |
| [simplex-noise](https://github.com/jwagner/simplex-noise.js) | MIT |
| [Lucide](https://lucide.dev) (simgeler) | ISC |
| [Tailwind CSS](https://tailwindcss.com) | MIT |
| [clsx](https://github.com/lukeed/clsx) | MIT |

## Yazı tipleri

| Yazı tipi | Lisans |
|---|---|
| [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (başlıklar), [Fontsource](https://fontsource.org) ile | SIL Open Font License 1.1 |
| [Nunito](https://fonts.google.com/specimen/Nunito) (metin), Fontsource ile | SIL Open Font License 1.1 |

## Geliştirme araçları

Vite, TypeScript, Vitest, oxlint ve tsx (MIT). Bunlar yalnızca geliştirmede kullanılır, siteye girmez.
