/**
 * YÖNETİM API'Sİ — yalnızca `npm run dev` sırasında, yalnızca bu bilgisayarda çalışır (yayında yoktur).
 *
 * Yönetim paneli (/yonetim) takipçi listesini bu uç noktalarla günceller; dosyalar doğrudan public/data/ içine yazılır.
 * Değişiklikleri yayına almak için ardından git ile commit + push yapılır (panel komutları gösterir).
 *
 *   GET  /__yonetim/durum      liste özeti, YouTube anahtarı var mı
 *   POST /__yonetim/onizle     { entries, reset }  → ne olacağı (yazmaz)
 *   POST /__yonetim/ekle       { entries, reset }  → yazar
 *   POST /__yonetim/cikar      { handles }         → haritadan çıkarır
 *   POST /__yonetim/sifirla    { onay: "SIFIRLA" } → bütün takipçileri siler (kadro kalır)
 *   POST /__yonetim/youtube    YouTube yorumlarını çeker (npm run youtube:yorumlar), adları döndürür
 *   POST /__yonetim/kontrol    veri denetimi (npm run data:check)
 *
 * Güvenlik: başka bir sitenin tarayıcın üzerinden istek atmasına karşı yalnızca bu sunucunun kendi adresinden gelen,
 * "X-Yonetim: 1" başlıklı ve JSON gövdeli istekler kabul edilir; Host başlığı localhost olmalıdır.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin, ViteDevServer } from "vite";

interface Entry {
  platform: string;
  handle: string;
  displayName: string;
}
interface FollowersLib {
  applyEntries(entries: Entry[], options?: { reset?: boolean }): { roster: { characters: unknown[] }; before: number; added: string[]; linked: string[]; skipped: string[] };
  removeHandles(handles: string[]): { roster: { characters: unknown[] }; removed: string[]; missing: string[] };
  saveRoster(roster: unknown): number;
  rosterSummary(): unknown;
}
interface FilesLib {
  parseFollowerFile(name: string, text: string, platform: string): { kind: string; entries: Entry[]; skipped: number };
}

const MAX_BODY = 8 * 1024 * 1024;
const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        fail(new Error("Gövde çok büyük"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        fail(new Error("JSON okunamadı"));
      }
    });
    req.on("error", fail);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/** Betiği tsx ile çalıştırır, çıktısını döndürür. */
function runScript(script: string): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const tsx = resolve("node_modules/tsx/dist/cli.mjs");
    const child = spawn(process.execPath, [tsx, script], { cwd: process.cwd(), env: process.env });
    let output = "";
    child.stdout.on("data", (d: Buffer) => (output += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (output += d.toString("utf8")));
    child.on("close", (code) => done({ code: code ?? 1, output }));
    child.on("error", (error) => done({ code: 1, output: String(error) }));
  });
}

/** İstek bu sunucunun kendi sayfasından mı geliyor? (başka sitelerin göndereceği isteklere karşı) */
function trusted(req: IncomingMessage): boolean {
  const host = req.headers.host ?? "";
  if (!LOCAL_HOSTS.test(host)) return false;
  if (req.method === "GET") return true;
  const origin = req.headers.origin;
  return req.headers["x-yonetim"] === "1" && (req.headers["content-type"] ?? "").startsWith("application/json") && origin !== undefined && new URL(origin).host === host;
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const route = (req.url ?? "").replace(/^\/__yonetim/, "").split("?")[0];
  const lib = (await server.ssrLoadModule("/scripts/lib/followers.ts")) as FollowersLib;
  if (req.method === "GET" && route === "/durum") {
    const env = existsSync(resolve(".env.local")) ? readFileSync(resolve(".env.local"), "utf8") : "";
    send(res, 200, { summary: lib.rosterSummary(), youtube: { key: /^YOUTUBE_API_KEY=\S+/m.test(env), channel: /^YOUTUBE_KANAL=(.+)$/m.exec(env)?.[1]?.trim() ?? null } });
    return;
  }
  if (req.method !== "POST") return send(res, 405, { error: "Yöntem desteklenmiyor" });
  const body = (await readBody(req)) as Record<string, unknown>;
  switch (route) {
    case "/onizle":
    case "/ekle": {
      const entries = Array.isArray(body.entries) ? (body.entries as Entry[]) : [];
      const result = lib.applyEntries(entries, { reset: body.reset === true });
      const cleaned = route === "/ekle" ? lib.saveRoster(result.roster) : 0;
      send(res, 200, { written: route === "/ekle", before: result.before, after: result.roster.characters.length, added: result.added, linked: result.linked, skipped: result.skipped, cleaned });
      return;
    }
    case "/cikar": {
      const handles = Array.isArray(body.handles) ? (body.handles as string[]) : [];
      const result = lib.removeHandles(handles);
      const cleaned = result.removed.length ? lib.saveRoster(result.roster) : 0;
      send(res, 200, { removed: result.removed, missing: result.missing, cleaned, after: result.roster.characters.length });
      return;
    }
    case "/sifirla": {
      if (body.onay !== "SIFIRLA") return send(res, 400, { error: 'Onay için "SIFIRLA" yazılmalı' });
      const result = lib.applyEntries([], { reset: true });
      const cleaned = lib.saveRoster(result.roster);
      send(res, 200, { before: result.before, after: 0, cleaned });
      return;
    }
    case "/youtube": {
      const run = await runScript("scripts/fetch-youtube-comments.ts");
      const csv = resolve("veri/girdi/youtube-yorumlar.csv");
      if (run.code !== 0 || !existsSync(csv)) return send(res, 400, { error: run.output.trim().split("\n").slice(-4).join("\n") || "YouTube yorumları çekilemedi" });
      const files = (await server.ssrLoadModule("/src/admin/followerFiles.ts")) as FilesLib;
      const parsed = files.parseFollowerFile("youtube-yorumlar.csv", readFileSync(csv, "utf8"), "youtube");
      send(res, 200, { kind: "YouTube yorumları", entries: parsed.entries, log: run.output.trim().split("\n").slice(-3).join("\n") });
      return;
    }
    case "/kontrol": {
      const run = await runScript("scripts/validate-data.ts");
      send(res, 200, { ok: run.code === 0, output: run.output.trim() });
      return;
    }
    default:
      send(res, 404, { error: "Bilinmeyen işlem" });
  }
}

export function yonetimPlugin(): Plugin {
  return {
    name: "oba-tales-yonetim",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__yonetim", (req, res) => {
        if (!trusted(req)) return send(res, 403, { error: "Yönetim API'si yalnızca bu bilgisayardaki panelden kullanılabilir" });
        handle(server, req, res).catch((error: unknown) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
      });
    },
  };
}
