/**
 * Küçük şekil kiti (betikler için): kodla low-poly parça üretip OBJ olarak yazar.
 * Kullanan: scripts/efsanevi-takipciler.ts (efsanevi takipçi modellerinin kaynağı).
 *
 * Bütün şekiller kapalıdır (içi dolu); yüz yönleri model:takipciler okurken zaten dışa çevrilir (objParse.ts).
 * Birim oyun birimidir (boy ≈ 4); OBJ'ye 10 kat büyütülerek yazılır (Blockbench ölçeği).
 */
export type V3 = [number, number, number];
export type Tri = [number, number, number];

export interface Mesh {
  p: V3[];
  t: Tri[];
}

export function merge(...parts: Mesh[]): Mesh {
  const out: Mesh = { p: [], t: [] };
  for (const m of parts) {
    const offset = out.p.length;
    out.p.push(...m.p.map((v) => [...v] as V3));
    out.t.push(...m.t.map(([a, b, c]) => [a + offset, b + offset, c + offset] as Tri));
  }
  return out;
}

export interface Placement {
  at?: V3;
  /** Radyan; önce x, sonra y, sonra z ekseni etrafında. */
  rot?: V3;
  scale?: V3 | number;
}

/** Ölçekle, döndür, taşı. */
export function place(m: Mesh, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1 }: Placement): Mesh {
  const s = typeof scale === "number" ? [scale, scale, scale] : scale;
  const [cx, sx] = [Math.cos(rot[0]), Math.sin(rot[0])];
  const [cy, sy] = [Math.cos(rot[1]), Math.sin(rot[1])];
  const [cz, sz] = [Math.cos(rot[2]), Math.sin(rot[2])];
  return {
    t: m.t.map((t) => [...t] as Tri),
    p: m.p.map(([x0, y0, z0]) => {
      let x = x0 * s[0];
      let y = y0 * s[1];
      let z = z0 * s[2];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      return [x + at[0], y + at[1], z + at[2]];
    }),
  };
}

/** Ortası başlangıçta kutu. */
export function box(w: number, h: number, d: number): Mesh {
  const [x, y, z] = [w / 2, h / 2, d / 2];
  const p: V3[] = [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
  ];
  const t: Tri[] = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
    [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5],
  ];
  return { p, t };
}

/** Altı köşeli elmas (taş, ışık). */
export function octa(rx: number, ry: number, rz: number): Mesh {
  const p: V3[] = [[rx, 0, 0], [-rx, 0, 0], [0, ry, 0], [0, -ry, 0], [0, 0, rz], [0, 0, -rz]];
  const t: Tri[] = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  return { p, t };
}

/**
 * Dönel şekil: profil (yarıçap, yükseklik) noktaları y ekseni etrafında döner. Uçlarda yarıçap 0 ise tek nokta,
 * değilse kapak. `loop` ise profil kapalı bir halkadır (simit gibi), kapak yoktur. sx/sz enine ve derinine ölçek.
 */
export function lathe(profile: readonly [number, number][], segments: number, { loop = false, sx = 1, sz = 1 } = {}): Mesh {
  const p: V3[] = [];
  const t: Tri[] = [];
  const rings: number[][] = profile.map(([r, y]) => {
    if (r < 1e-9 && !loop) {
      p.push([0, y, 0]);
      return [p.length - 1];
    }
    const ring: number[] = [];
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      p.push([Math.cos(a) * r * sx, y, Math.sin(a) * r * sz]);
      ring.push(p.length - 1);
    }
    return ring;
  });
  const link = (A: number[], B: number[]) => {
    for (let s = 0; s < segments; s++) {
      const a0 = A[A.length === 1 ? 0 : s];
      const a1 = A[A.length === 1 ? 0 : (s + 1) % segments];
      const b0 = B[B.length === 1 ? 0 : s];
      const b1 = B[B.length === 1 ? 0 : (s + 1) % segments];
      if (a0 !== a1) t.push([a0, a1, b1]);
      if (b0 !== b1) t.push([a0, b1, b0]);
    }
  };
  for (let k = 0; k + 1 < rings.length; k++) link(rings[k], rings[k + 1]);
  if (loop) link(rings[rings.length - 1], rings[0]);
  else {
    const cap = (ring: number[], y: number) => {
      if (ring.length === 1) return;
      p.push([0, y, 0]);
      const c = p.length - 1;
      for (let s = 0; s < segments; s++) t.push([c, ring[(s + 1) % segments], ring[s]]);
    };
    cap(rings[0], profile[0][1]);
    cap(rings[rings.length - 1], profile[profile.length - 1][1]);
  }
  return { p, t };
}

/** Simit: xz düzleminde, R büyük yarıçap, r boru yarıçapı. */
export function torus(R: number, r: number, segments: number, sides: number, { sx = 1, sz = 1 } = {}): Mesh {
  const profile: [number, number][] = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    profile.push([R + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return lathe(profile, segments, { loop: true, sx, sz });
}

/** Basit çokgeni (xy düzleminde) kulak kırpma yöntemiyle üçgenler. */
function triangulate(poly: readonly [number, number][]): Tri[] {
  const area = poly.reduce((sum, [x, y], k) => {
    const [nx, ny] = poly[(k + 1) % poly.length];
    return sum + x * ny - nx * y;
  }, 0);
  const index = poly.map((_, k) => k);
  if (area < 0) index.reverse();
  const out: Tri[] = [];
  const inside = (p: [number, number], a: [number, number], b: [number, number], c: [number, number]) => {
    const d = (u: [number, number], v: [number, number], w: [number, number]) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    return d(a, b, p) >= 0 && d(b, c, p) >= 0 && d(c, a, p) >= 0;
  };
  let guard = 0;
  while (index.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < index.length; k++) {
      const [ia, ib, ic] = [index[(k + index.length - 1) % index.length], index[k], index[(k + 1) % index.length]];
      const [a, b, c] = [poly[ia], poly[ib], poly[ic]];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 0) continue; // içbükey köşe
      if (index.some((j) => j !== ia && j !== ib && j !== ic && inside(poly[j], a, b, c))) continue;
      out.push([ia, ib, ic]);
      index.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (index.length === 3) out.push([index[0], index[1], index[2]]);
  return out;
}

/** xy düzlemindeki çokgeni z boyunca `depth` kalınlıkta uzatır (ortası z = 0). */
export function extrude(poly: readonly [number, number][], depth: number): Mesh {
  const n = poly.length;
  const p: V3[] = [...poly.map(([x, y]) => [x, y, depth / 2] as V3), ...poly.map(([x, y]) => [x, y, -depth / 2] as V3)];
  const t: Tri[] = [];
  for (const [a, b, c] of triangulate(poly)) {
    t.push([a, b, c]);
    t.push([c + n, b + n, a + n]);
  }
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    t.push([k, k + n, j + n], [k, j + n, j]);
  }
  return { p, t };
}

/**
 * Kalın yaprak (pelerin, yele, tüy): fn(u, v) yüzeyin orta noktası (u, v 0–1); her noktada yüzeye dik yönde
 * `thickness` kalınlık verilir ve kenarlar kapatılır.
 */
export function sheet(fn: (u: number, v: number) => V3, nu: number, nv: number, thickness: number | ((u: number, v: number) => number)): Mesh {
  const at = (i: number, j: number) => fn(i / nu, j / nv);
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const normalAt = (i: number, j: number): V3 => {
    const du = sub(at(Math.min(nu, i + 1), j), at(Math.max(0, i - 1), j));
    const dv = sub(at(i, Math.min(nv, j + 1)), at(i, Math.max(0, j - 1)));
    const n: V3 = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
    const l = Math.hypot(...n) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  const p: V3[] = [];
  const front: number[][] = [];
  const back: number[][] = [];
  for (let i = 0; i <= nu; i++) {
    front.push([]);
    back.push([]);
    for (let j = 0; j <= nv; j++) {
      const c = at(i, j);
      const n = normalAt(i, j);
      const h = (typeof thickness === "number" ? thickness : thickness(i / nu, j / nv)) / 2;
      p.push([c[0] + n[0] * h, c[1] + n[1] * h, c[2] + n[2] * h]);
      front[i].push(p.length - 1);
      p.push([c[0] - n[0] * h, c[1] - n[1] * h, c[2] - n[2] * h]);
      back[i].push(p.length - 1);
    }
  }
  const t: Tri[] = [];
  const quad = (a: number, b: number, c: number, d: number) => t.push([a, b, c], [a, c, d]);
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      quad(front[i][j], front[i + 1][j], front[i + 1][j + 1], front[i][j + 1]);
      quad(back[i][j + 1], back[i + 1][j + 1], back[i + 1][j], back[i][j]);
    }
  // Kenarlar: ön ve arka yüzü birleştiren şeritler.
  for (let i = 0; i < nu; i++) {
    quad(front[i][0], back[i][0], back[i + 1][0], front[i + 1][0]);
    quad(front[i + 1][nv], back[i + 1][nv], back[i][nv], front[i][nv]);
  }
  for (let j = 0; j < nv; j++) {
    quad(front[0][j + 1], back[0][j + 1], back[0][j], front[0][j]);
    quad(front[nu][j], back[nu][j], back[nu][j + 1], front[nu][j + 1]);
  }
  return { p, t };
}

/** Bir parçayı OBJ satırlarına çevirir (10 kat büyütülmüş). Köşe ve normal sıra numaraları dosyada kaldığı yerden devam eder. */
export function objBlock(name: string, m: Mesh, vStart: number, vnStart: number, scale = 10): { lines: string[]; v: number; vn: number } {
  const lines = [`o ${name}`, `usemtl ${name}`];
  const fmt = (x: number) => (Math.round(x * scale * 10000) / 10000).toFixed(4);
  for (const [x, y, z] of m.p) lines.push(`v ${fmt(x)} ${fmt(y)} ${fmt(z)}`);
  let vn = 0;
  const faces: string[] = [];
  for (const [a, b, c] of m.t) {
    const [pa, pb, pc] = [m.p[a], m.p[b], m.p[c]];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-12) continue;
    lines.push(`vn ${(n[0] / l).toFixed(4)} ${(n[1] / l).toFixed(4)} ${(n[2] / l).toFixed(4)}`);
    vn++;
    const k = vnStart + vn;
    faces.push(`f ${vStart + a + 1}//${k} ${vStart + b + 1}//${k} ${vStart + c + 1}//${k}`);
  }
  lines.push(...faces);
  return { lines, v: m.p.length, vn };
}
