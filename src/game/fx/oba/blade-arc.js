// OBA-Tales: Gün Kılıcı — kılıç savuruşu. Göğüs hizasında arkadan öne doğru süpüren hilal: önde beyaz-sıcak kesik,
// arkasında altından turuncuya sönen iz, ucunda bir parıltı ve dökülen kıvılcımlar. OBA-Tales için yazıldı.
import { Particles, Lights, P, Rng, fit, clamp, smooth, sparkle, WHITE } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Blade arc",
  desc: "Gün Kılıcı: karakterin önünde arkadan öne süpüren parlak bir kılıç hilali; iz altından turuncuya söner, uçta parıltı ve kıvılcımlar.",
  tags: ["slash", "sword", "melee", "oba-tales", "one-shot"],
  size: [120, 100],
  origin: [44, 88],
  duration: 0.75,
  loop: false,
  fps: 30,
  options: {
    // koyudan açığa: iz → kesik
    palette: ["#3b2a08", "#7a5612", "#b8861c", "#e2a52a", "#f6d36f", "#fbe7a6", "#fff8e0", "#ffffff"],
    radius: 30,
    seed: 5,
  },
};

const SWING = 0.18; // kesiğin süpürme süresi
const TRAIL = 0.4; // izin arkadan yetişme süresi
const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), r0 = Number(o.radius) || 30;
  const cx = 6, cy = -30; // göğüs hizası, biraz önde
  const a0 = -2.6, a1 = 0.75; // arkadan-yukarıdan öne-aşağıya
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[7], C[6], C[4], C[2]] });
  const lights = new Lights();
  const at = (a, r = r0) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.78];
  let t = 0, burst = false;

  return {
    update(dt) {
      t += dt;
      // Kesik bitince uçtan kıvılcım saçılır.
      if (!burst && t >= SWING) {
        burst = true;
        const [tx, ty] = at(a1);
        lights.add(tx, ty, 26, C[5], 0.8, 0.25);
        for (let i = 0; i < 12; i++) {
          const a = a1 + Math.PI / 2 + R.range(-0.9, 0.9), v = R.range(60, 180);
          ps.spawn(P.SPARK, tx, ty, Math.cos(a) * v, Math.sin(a) * v - 20, R.range(0.15, 0.4), WHITE, 1);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      const head = a0 + (a1 - a0) * ease(t / SWING);
      const tail = a0 + (a1 - a0) * ease((t - 0.05) / TRAIL);
      const fade = 1 - smooth(SWING + 0.16, 0.72, t);
      if (fade > 0 && head > tail + 0.01) {
        const span = head - tail, steps = Math.ceil(span * r0 * 2.4);
        // İki iz: içte ince bir gölge-iz, dışta kalın, parlak kesik (derinlik ve hız hissi).
        for (const [dr, wk, ak] of [
          [-7, 0.45, 0.55],
          [0, 1, 1],
        ]) {
          for (let i = 0; i <= steps; i++) {
            const u = i / steps; // 0 kuyruk → 1 kesik
            const a = tail + span * u;
            const w = (1.5 + 9 * Math.pow(u, 1.3)) * wk * (0.65 + 0.35 * fade);
            for (let off = -w / 2; off <= w / 2 + 0.01; off += 0.5) {
              const edge = (off + w / 2) / w; // 0 iç kenar → 1 dış kenar
              const [x, y] = at(a, r0 + dr + off);
              const col = u > 0.85 && edge > 0.35 ? WHITE : u > 0.65 ? (edge > 0.55 ? C[7] : C[6]) : u > 0.4 ? (edge > 0.5 ? C[5] : C[4]) : edge > 0.5 ? C[3] : C[2];
              p.dot(x, y, col, ak * fade * (0.4 + 0.6 * u));
            }
            if ((i & 1) === 0) {
              const [x, y] = at(a, r0 + dr);
              p.light(x, y, C[5], 0.4 * ak * u * fade);
            }
          }
        }
        // kesiğin ucu: kılıç ağzının parıltısı
        const [hxp, hyp] = at(head);
        p.glow(hxp, hyp, 14, C[6], 0.7 * fade);
        if (t > SWING * 0.6 && t < SWING + 0.18) sparkle(p, hxp, hyp, 4 + 3 * (1 - Math.abs(t - SWING) / 0.18), C[6], C[4], 0.7);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
