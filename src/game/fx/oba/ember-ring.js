// OBA-Tales: Bin Taş Ocağı — BinTaş'ın imza yeteneği. Ayaklarının çevresine kor taşları birer birer serpilir, her biri
// parlayıp küçük alevler verir; havada bir ateş küresi büyür, yükselir ve közlere saçılarak patlar; halka söner.
// Halkanın arka yarısı karakterin arkasında, ön yarısı önünde çizilir. OBA-Tales için yazıldı.
import { Particles, Lights, P, PF, Rng, fit, clamp, smooth, WHITE } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Ember ring",
  desc: "Bin Taş Ocağı: ayakların çevresine kor taşları serpilir ve alev verir; bir ateş küresi büyüyüp yükselir, közlere saçılarak patlar.",
  tags: ["fire", "ember", "ring", "orb", "oba-tales", "one-shot"],
  size: [88, 96],
  origin: [44, 88],
  duration: 2,
  loop: false,
  fps: 30,
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    stones: 16,
    seed: 21,
  },
};

const ORB_AT = 0.45, BURST_AT = 1.05, OUT = 1.45;

export function create(o) {
  const C = fit(o.palette, 9), R = new Rng(o.seed), n = Math.max(6, Number(o.stones) || 16);
  const RX = 30, RY = 8;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[8], C[6], C[4], C[2]] });
  const lights = new Lights();
  const stones = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + R.range(-0.12, 0.12);
    return { a, x: Math.cos(a) * RX, y: Math.sin(a) * RY, at: (i / n) * 0.35 + R.range(0, 0.05), ph: R.range(0, 6.28), lit: false };
  });
  const orb = { x: 12, y0: -40, y1: -64 };
  let t = 0, burst = false;

  const orbPos = () => {
    const k = smooth(ORB_AT, BURST_AT, t);
    return [orb.x - 12 * k, orb.y0 + (orb.y1 - orb.y0) * k, 2 + 7 * smooth(ORB_AT, ORB_AT + 0.4, t)];
  };

  const drawStones = (p, far) => {
    const fade = 1 - smooth(OUT, OUT + 0.45, t);
    if (fade <= 0) return;
    for (const s of stones) {
      if (t < s.at || (s.y < 0) !== far) continue;
      const pop = clamp((t - s.at) / 0.08), flick = 0.65 + 0.35 * Math.sin(t * 19 + s.ph);
      p.disc(s.x, s.y, 1.6 * pop, C[1], fade);
      p.dot(s.x, s.y - 1, flick > 0.85 ? C[7] : C[5], fade);
      p.dot(s.x - 1, s.y, C[3], fade);
      p.light(s.x, s.y - 1, C[4], 0.55 * flick * fade);
    }
    // halkanın sıcaklığı yerde ince bir parıltı
    if (!far) p.glow(0, 0, RX + 6, C[3], 0.18 * fade * smooth(0, 0.35, t));
  };

  return {
    update(dt) {
      t += dt;
      for (const s of stones) {
        if (t < s.at) continue;
        if (!s.lit) {
          s.lit = true;
          lights.add(s.x, s.y - 2, 10, C[5], 0.6, 0.2);
          ps.spawn(P.SPARK, s.x, s.y, R.range(-30, 30), -R.range(40, 90), R.range(0.15, 0.3), C[7], 1);
        }
        if (t < OUT && R.chance(Math.min(1, dt * 7))) ps.spawn(P.FIRE, s.x + R.range(-1, 1), s.y - 1, R.range(-4, 4), -R.range(8, 18), R.range(0.18, 0.34), 0, R.range(0.7, 1.3), 0, R.chance(0.3) ? PF.SMOKES : 0);
      }
      // küre büyürken çevresinden alev emer
      if (t > ORB_AT && t < BURST_AT && R.chance(Math.min(1, dt * 30))) {
        const [ox, oy, r] = orbPos(), a = R.range(0, 6.28), d = r + R.range(6, 14);
        ps.spawn(P.EMBER, ox + Math.cos(a) * d, oy + Math.sin(a) * d, -Math.cos(a) * 40, -Math.sin(a) * 40, 0.25, C[6], 1);
      }
      if (!burst && t >= BURST_AT) {
        burst = true;
        const [ox, oy] = orbPos();
        lights.add(ox, oy, 60, C[6], 1, 0.45);
        lights.add(ox, oy, 16, WHITE, 1, 0.12);
        for (let i = 0; i < 28; i++) {
          const a = R.range(0, 6.28), v = R.range(40, 160);
          ps.spawn(i % 3 ? P.EMBER : P.SPARK, ox, oy, Math.cos(a) * v, Math.sin(a) * v - 20, R.range(0.35, 0.8), i % 2 ? C[6] : C[4], R.range(0.8, 1.4));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      drawStones(p, true);
    },
    draw(p) {
      drawStones(p, false);
      if (t > ORB_AT && t < BURST_AT + 0.05) {
        const [ox, oy, r] = orbPos();
        const pulse = 1 + 0.12 * Math.sin(t * 30);
        p.circle(ox, oy, r * pulse + 1, C[2]);
        p.circle(ox, oy, r * pulse, C[4]);
        p.circle(ox, oy, r * pulse * 0.62, C[6]);
        p.circle(ox, oy, r * pulse * 0.28, C[8]);
        p.glow(ox, oy, r * 3.2, C[5], 0.55);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
