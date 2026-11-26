/**
 * Blender'ı arka planda çalıştırır (pencere açmadan).
 *
 *   npm run blender:kit       modeller/kit.json → modeller/OBA-Tales-karakter-kit.blend (+ onizleme.png)
 *                             Dosya zaten varsa dokunmaz: içinde senin emeğin olabilir.
 *                             `npm run blender:kit -- --yenile` eskisini yedekleyip (…-yedek-<tarih>.blend) yeniden kurar.
 *   npm run blender:kahramanlar  kadro OBJ'leri → iskeletli ve animasyonlu public/models/kahraman-<kimlik>.glb
 *                             (+ modeller/kahramanlar/<kimlik>-onizleme.png). İsteğe bağlı: -- mhellingtr,bintas
 *   npm run blender:hayvanlar Kutada'nın hayvanları (geyik, tavşan, kuş) → iskeletli public/models/hayvan-<tür>.glb
 *                             (+ modeller/hayvanlar/<tür>-onizleme.png). İsteğe bağlı: -- geyik,kus
 *   npm run blender:aktar     .blend → public/models/karakter-kit.glb, ardından npm run blender:kontrol
 *                             (Blender açıkken Alt+P ile aktarmakla aynı şey.)
 *
 * Blender'ı şu sırayla arar: BLENDER_PATH ortam değişkeni (.env.local'a da yazılabilir), Windows'ta
 * "C:\Program Files\Blender Foundation\Blender X.Y\blender.exe" (en yeni sürüm), macOS'ta /Applications,
 * yoksa PATH'teki `blender`.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { yenile: { type: "boolean", default: false } },
});

const KIT_JSON = resolve("modeller/kit.json");
const BLEND = resolve("modeller/OBA-Tales-karakter-kit.blend");
const PREVIEW = resolve("modeller/onizleme.png");
const GLB = resolve("public/models/karakter-kit.glb");
const SCRIPTS = resolve("scripts/blender");

function envLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = resolve(".env.local");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^"(.*)"$/, "$1") || undefined;
}

function findBlender(): string {
  const fromEnv = envLocal("BLENDER_PATH");
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`BLENDER_PATH bulunamadı: ${fromEnv}`);
    return fromEnv;
  }
  if (process.platform === "win32") {
    const base = join(process.env.ProgramFiles ?? "C:\\Program Files", "Blender Foundation");
    if (existsSync(base)) {
      const version = (name: string) => (name.match(/\d+/g) ?? []).map(Number);
      const newest = readdirSync(base)
        .filter((d) => existsSync(join(base, d, "blender.exe")))
        .sort((a, b) => {
          const [va, vb] = [version(a), version(b)];
          for (let i = 0; i < Math.max(va.length, vb.length); i++) if ((va[i] ?? 0) !== (vb[i] ?? 0)) return (vb[i] ?? 0) - (va[i] ?? 0);
          return 0;
        })[0];
      if (newest) return join(base, newest, "blender.exe");
    }
  }
  if (process.platform === "darwin" && existsSync("/Applications/Blender.app/Contents/MacOS/Blender")) return "/Applications/Blender.app/Contents/MacOS/Blender";
  return "blender";
}

function runBlender(blendArgs: string[]): void {
  const blender = findBlender();
  console.log(`Blender: ${blender}`);
  const result = spawnSync(blender, ["--background", ...blendArgs], { stdio: "inherit" });
  if (result.error) throw new Error(`Blender çalıştırılamadı (${result.error.message}). Yolu .env.local içine BLENDER_PATH=... olarak yaz.`);
  if (result.status !== 0) throw new Error(`Blender hata ile bitti (çıkış kodu ${result.status}).`);
}

function buildKit(): void {
  if (!existsSync(KIT_JSON)) throw new Error("modeller/kit.json yok: önce npm run modeller");
  if (existsSync(BLEND)) {
    if (!args.yenile) {
      console.log(`Zaten var: ${BLEND}\nİçinde senin değişikliklerin olabilir, dokunmadım. Sıfırdan kurmak için: npm run blender:kit -- --yenile`);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const backup = BLEND.replace(/\.blend$/, `-yedek-${stamp}.blend`);
    copyFileSync(BLEND, backup);
    console.log(`Eski dosya yedeklendi: ${backup}`);
  }
  runBlender(["--factory-startup", "--python-exit-code", "1", "--python", join(SCRIPTS, "kit_olustur.py"), "--", KIT_JSON, BLEND, PREVIEW]);
  console.log(`\n✔ Hazır: ${BLEND}\n  Blender'da aç, COL_KIT içindeki parçaları düzenle, Alt+P ile oyuna aktar (ayrıntı: modeller/README.md).`);
}

function exportKit(out = GLB): void {
  if (!existsSync(BLEND)) throw new Error(`Bulunamadı: ${BLEND}\nÖnce: npm run blender:kit`);
  runBlender([BLEND, "--python-exit-code", "1", "--python", join(SCRIPTS, "oyuna_aktar.py"), "--", out]);
}

try {
  const command = positionals[0];
  if (command === "kit") buildKit();
  else if (command === "aktar") exportKit(positionals[1] ? resolve(positionals[1]) : GLB);
  else if (command === "hayvanlar")
    runBlender(["--factory-startup", "--python-exit-code", "1", "--python", join(SCRIPTS, "hayvanlar.py"), "--", resolve("public/models"), resolve("modeller/hayvanlar"), positionals[1] ?? ""]);
  else if (command === "kahramanlar")
    runBlender(["--factory-startup", "--python-exit-code", "1", "--python", join(SCRIPTS, "kahraman_iskelet.py"), "--", resolve("modeller/referans"), resolve("public/models"), resolve("modeller/kahramanlar"), positionals[1] ?? ""]);
  else throw new Error("Kullanım: tsx scripts/blender/calistir.ts kit [--yenile] | aktar [cikti.glb] | kahramanlar [kimlik,kimlik] | hayvanlar [tur,tur]");
} catch (error) {
  console.error(`✘ ${(error as Error).message}`);
  process.exit(1);
}
