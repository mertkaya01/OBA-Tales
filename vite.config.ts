import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;

/**
 * public/_headers dosyasındaki "/*" bloğu (Cloudflare Pages başlıkları). `npm run preview` aynı başlıklarla
 * çalışsın diye okunur: CSP ve güvenlik başlıkları yayından önce yerelde denenebilir.
 */
function siteHeaders(): Record<string, string> {
  const file = resolve(root, "public/_headers");
  if (!existsSync(file)) return {};
  const headers: Record<string, string> = {};
  let inBlock = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.startsWith("#") || line.trim() === "") continue;
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === "/*";
      continue;
    }
    const match = inBlock && /^\s+([^:]+):\s*(.+)$/.exec(line);
    if (match) headers[match[1].trim()] = match[2].trim();
  }
  return headers;
}

/**
 * Yayın hazırlığı:
 *   · vendor'daki pixelfx'in MIT lisansı ve atıfları dist/lisanslar/pixelfx.txt olarak yayınlanır
 *     (npm paketlerinin lisansları Vite'ın build.license çıktısında)
 *   · performans testi verisi (roster.stress.json) yayına girmez
 */
function obaTalesRelease(): Plugin {
  let outDir = "dist";
  return {
    name: "oba-tales-yayin",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle() {
      const vendor = resolve(root, "src/vendor/pixelfx");
      const text = [
        "pixelfx — https://github.com/patch-gg/pixelfx (commit 5294518ce7c72e48b6100a744596e0acf57f2826)",
        "OBA-Tales sitesindeki piksel efektleri bu projeden alınmıştır.",
        "",
        readFileSync(resolve(vendor, "LICENSE"), "utf8").trim(),
        "",
        readFileSync(resolve(vendor, "NOTICE.md"), "utf8").trim(),
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "lisanslar/pixelfx.txt", source: text });
    },
    closeBundle() {
      rmSync(resolve(outDir, "data/roster.stress.json"), { force: true });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), obaTalesRelease()],
  build: {
    // 3D dünya parçası (three + React Three Fiber + drei) ~1 MB; yalnızca Dünya görünümü açılınca yüklenir.
    chunkSizeWarningLimit: 1100,
    // Paketlenen bütün npm bağımlılıklarının lisans metinleri (MIT vb. lisanslar kopyalarda bulunmayı ister).
    license: { fileName: "lisanslar/ucuncu-taraf.txt" },
  },
  preview: {
    headers: siteHeaders(),
  },
  optimizeDeps: {
    // Ağır motorlar yalnızca harita/dünya açılınca yüklenir. Geliştirme sunucusu bunları açılışta
    // önceden paketlesin; yoksa ilk açılışta yeniden paketleme sırasında iki React kopyası karışabilir.
    include: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "leaflet",
      "react-leaflet",
      "leaflet.markercluster",
      "simplex-noise",
      "pixi.js",
    ],
  },
});
