// OBA-Tales: Kalkan Duvarı — boyu ayarlanabilen enerji kalkanı (size: 1 = pixelfx'in shield-block'u kadar).
// pixelfx'in impacts/shield-block efektinden uyarlandı (src/vendor/pixelfx, MIT: Patch, Hugo Duprez); o da Sprite Fusion'ın
// açık kaynak kalkanından (https://www.spritefusion.com/pixel-art-vfx/shield, MIT, Copyright (c) 2026 Hugo Duprez).
// Kalkaneri nadirliği ve rozetleri arttıkça kalkan büyür (fxCatalog.shieldSize); egetunce'nin lavanta kalkanı en büyüğü.
import { Particles, Lights, P, Rng, fit, clamp, smooth, rand, WHITE } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Shield wall",
  desc: "Kalkan Duvarı: karakterin önünde elmas örgülü bir enerji kubbesi parlar, üstünden dalga geçer, kıvılcımlar seker, sonra hücre hücre söner. size ile büyür.",
  tags: ["impact", "block", "shield", "oba-tales", "one-shot"],
  size: [148, 104],
  origin: [40, 88],
  duration: 1.25,
  loop: false,
  fps: 30,
  options: {
    palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    size: 1,
    seed: 12,
  },
};

export function create(o) {
  const s = clamp(Number(o.size) || 1, 0.6, 2);
  const C = fit(o.palette, 8), S = fit(o.sparks, 4), R = new Rng(o.seed);
  // Kubbenin yüzü, derinliği, boyu; örgü aynı sayıda hücre (büyük kalkanda hücreler büyür, karakter görünür kalır).
  const CX = 3, RX = 28 * s, RY = 44 * s, GRID = 3.4;
  const HIT = { lon: 1.18, lat: 0.5 }, GONE = 0.5 + 0.12 * (s - 1);
  const onDome = (lon, lat) => [CX + RX * Math.cos(lat) * Math.sin(lon), -RY * Math.sin(lat)];
  const ps = new Particles({ rng: R, ground: () => 0, sparks: S });
  const lights = new Lights();
  const [hx, hy] = onDome(HIT.lon, HIT.lat);

  lights.add(hx, hy, 40 * s, S[1], 0.7, 0.2);
  lights.add(hx, hy, 12 * s, WHITE, 0.7, 0.06);
  const nA = Math.atan2(-Math.sin(HIT.lat) / RY, (Math.cos(HIT.lat) * Math.sin(HIT.lon)) / RX);
  const sparkCount = Math.round(14 * s);
  for (let i = 0; i < sparkCount; i++) {
    const a = nA + R.range(-1.2, 0.9), v = R.range(130, 300) * Math.sqrt(s);
    ps.spawn(P.SPARK, hx + 1, hy, Math.cos(a) * v, Math.sin(a) * v - 30, R.range(0.15, 0.42), WHITE, 1, i > sparkCount * 0.75 ? R.range(0.01, 0.04) : 0);
  }

  let t = 0;
  const dome = (p, back) => {
    const fade = 1 - smooth(GONE + 0.35, GONE + 0.55, t);
    if (fade <= 0) return;
    for (let y = Math.floor(-RY) - 1; y < 0; y++)
      for (let x = CX; x <= Math.ceil(CX + RX) + 1; x++) {
        const u = (x + 0.5 - CX) / RX, v = -(y + 0.5) / RY, q = u * u + v * v;
        if (q > 1 || u < 0 || v < 0) continue;
        const z = Math.sqrt(1 - q) * (back ? -1 : 1), lon = Math.atan2(u, z), lat = Math.asin(clamp(v));
        const a = (lon + lat) * GRID, b = (lon - lat) * GRID, fa = a - Math.floor(a), fb = b - Math.floor(b);
        const cell = rand(Math.floor(a), Math.floor(b), 31), line = Math.min(fa, 1 - fa, fb, 1 - fb) < 0.13;
        const gone = GONE + cell * 0.35;
        if (t > gone) continue;
        const d = Math.acos(clamp(Math.cos(lat) * Math.cos(HIT.lat) * Math.cos(lon - HIT.lon) + Math.sin(lat) * Math.sin(HIT.lat), -1, 1));
        let hit = 0;
        for (const [t0, k0] of [[0, 1], [0.12, 0.55]]) {
          const k = t - t0, front = k * 3.6;
          if (k < 0 || k > 0.55) continue;
          if (Math.abs(d - front) < 0.2) hit = Math.max(hit, k0 * (1 - k / 0.55));
          else if (d < front) hit = Math.max(hit, 0.3 * k0 * (1 - k / 0.55));
        }
        const rim = 1 - Math.abs(z), flash = t < 0.05, blink = t > gone - 0.06;
        const sheen = Math.abs(((((lat * 0.8 - lon * 0.3 - t * 1.6) % 1) + 1) % 1) - 0.5) < 0.05;
        if (back) {
          if (line) p.dot(x, y, C[3], 0.5 * fade);
          continue;
        }
        if (q > 0.9) p.dot(x, y, flash || hit > 0.5 ? WHITE : C[6], fade);
        else if (line) p.dot(x, y, flash || blink || hit > 0.5 ? WHITE : hit > 0.2 || sheen ? C[6] : rim > 0.7 ? C[5] : rim > 0.35 ? C[4] : C[3], fade);
        else p.blend(x, y, flash || hit > 0.35 ? C[6] : C[3], fade * Math.min(0.85, (flash ? 0.35 : 0.1 + 0.25 * rim * rim) + hit * 0.65));
        if (((x * 7 + y * 3) & 15) === 0) p.light(x, y, C[4], 0.15 + 0.5 * hit);
      }
  };

  return {
    update(dt) {
      t += dt;
      if (t > GONE && t < GONE + 0.38 && R.chance(0.5 * s)) {
        const lon = R.range(0, Math.PI / 2), lat = R.range(0.05, 1.4), [x, y] = onDome(lon, lat);
        ps.spawn(P.STAR, x, y, R.range(-10, 10), -R.range(10, 40), R.range(0.2, 0.36), R.chance(0.5) ? C[6] : C[5], R.range(0.6, 1.4));
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      dome(p, true);
    },
    draw(p) {
      dome(p, false);
      const fade = 1 - smooth(GONE + 0.3, GONE + 0.55, t);
      if (fade > 0) for (let x = CX; x <= CX + RX; x++) p.dot(x, 0, t < 0.05 ? WHITE : C[5], fade * (0.6 + 0.4 * ((x - CX) / RX)));
      ps.draw(p);
      p.glow(CX + RX * 0.5, -RY * 0.45, RY * 0.9, C[4], 0.2 * (1 - smooth(GONE, GONE + 0.55, t)) + 0.35 * Math.exp(-t / 0.08));
      lights.draw(p);
    },
  };
}
