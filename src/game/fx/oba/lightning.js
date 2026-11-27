// OBA-Tales: Gök Gürültüsü — yıldırımlar. Gökten tuvalin tepesinden zikzak şimşekler iner: beyaz çekirdek, mavi kabuk,
// dallanan kollar; her çarpışta yer parlar, kıvılcım saçılır. Son yıldırım karakterin tam üstüne düşer.
// Portrenin kararması ve geri aydınlanması LivePortrait'te (fxCatalog'daki darkness zaman çizelgesi). OBA-Tales için yazıldı.
import { Particles, Lights, P, Rng, fit, WHITE } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Lightning",
  desc: "Gök Gürültüsü: gökten zikzak yıldırımlar iner, dallanır, çarptığı yer parlar ve kıvılcım saçar; sonuncusu karakterin üstüne düşer.",
  tags: ["lightning", "storm", "thunder", "oba-tales", "one-shot"],
  size: [88, 96],
  origin: [44, 88],
  duration: 1.25,
  loop: false,
  fps: 30,
  options: {
    palette: ["#0a1030", "#1c2a66", "#2f56a8", "#4fa3e0", "#7fe6ff", "#b8f4ff", "#e8fcff", "#ffffff"],
    // her yıldırımın düştüğü an (sn) ve yatay yeri (ayaklara göre, piksel)
    strikes: [
      [0.3, -24],
      [0.47, 22],
      [0.6, -8],
      [0.82, 0],
    ],
    top: -92,
    seed: 9,
  },
};

const LIT = 0.15; // bir yıldırımın görünür kaldığı süre

/** Uçtan uca zikzak yol (orta nokta kaydırma): [[x, y], …] */
function bolt(R, x0, y0, x1, y1, jag, depth) {
  let pts = [
    [x0, y0],
    [x1, y1],
  ];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      next.push([(ax + bx) / 2 + R.range(-1, 1) * len * jag, (ay + by) / 2 + R.range(-0.25, 0.25) * len * jag], [bx, by]);
    }
    pts = next;
  }
  return pts;
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), top = Number(o.top) || -92;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]] });
  const lights = new Lights();
  // Yıldırımlar önceden çizilir: ana kol ve bir-iki dal. Sonuncusu karakterin başına (y ≈ -58) iner.
  const strikes = o.strikes.map(([at, x], i) => {
    const last = i === o.strikes.length - 1;
    const endY = last ? -58 : -R.range(0, 4);
    const main = bolt(R, x + R.range(-10, 10), top, x, endY, 0.22, 5);
    const forks = [];
    for (let f = 0; f < (last ? 3 : 2); f++) {
      const from = main[Math.floor(R.range(0.25, 0.7) * main.length)];
      const dir = R.chance(0.5) ? 1 : -1;
      forks.push(bolt(R, from[0], from[1], from[0] + dir * R.range(8, 18), from[1] + R.range(10, 22), 0.3, 3));
    }
    return { at, x, endY, main, forks, hit: false, last };
  });
  let t = 0;

  const draw = (p, path, core, shell, k) => {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      p.line(ax - 1, ay, bx - 1, by, shell, k);
      p.line(ax + 1, ay, bx + 1, by, shell, k);
      p.line(ax, ay, bx, by, core, k);
      if (i % 2 === 0) p.light(bx, by, shell, 0.5 * k);
    }
  };

  return {
    update(dt) {
      t += dt;
      for (const s of strikes) {
        if (s.hit || t < s.at) continue;
        s.hit = true;
        lights.add(s.x, s.endY, s.last ? 70 : 46, C[5], s.last ? 1 : 0.75, s.last ? 0.45 : 0.25);
        lights.add(s.x, s.endY, 14, WHITE, 1, 0.1);
        for (let i = 0; i < (s.last ? 18 : 9); i++) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), v = R.range(70, 200);
          ps.spawn(P.SPARK, s.x, s.endY, Math.cos(a) * v, Math.sin(a) * v, R.range(0.15, 0.45), WHITE, 1);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      for (const s of strikes) {
        const k = t - s.at;
        if (k < 0 || k > LIT) continue;
        // titrer: yanar, bir an söner, yeniden yanar
        if (k > 0.04 && k < 0.065) continue;
        const a = 1 - (k / LIT) * 0.5;
        for (const f of s.forks) draw(p, f, C[6], C[4], a * 0.8);
        draw(p, s.main, WHITE, C[5], a);
        // gökyüzü çakışla aydınlanır
        p.glow(s.x, (top + s.endY) / 2, 60, C[4], 0.35 * a);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
