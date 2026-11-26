/**
 * OBJ okuyucu (betikler için): her `o` nesnesi bir parça; köşeler parça içinde birleşir, üçgen indeksleri tutulur,
 * yüz yönleri OBJ normalleriyle denetlenir, yanındaki .mtl'den parçanın rengi (Kd) okunur.
 * Kullanan: scripts/obj-to-kit.ts, scripts/takipci-modelleri.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ObjPart {
  /** x, y, z sırayla (ölçeklenmiş, milimetreye yuvarlanmış). */
  p: number[];
  i: number[];
  /** .mtl renk (#rrggbb), yoksa undefined. */
  c?: string;
}

export interface ObjModel {
  parts: Map<string, ObjPart>;
  triangles: number;
  flipped: number;
}

type Vec = [number, number, number];
const LINES = /\r?\n/;
const SPACES = /\s+/;
const round = (v: number) => Math.round(v * 1000) / 1000;
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hex = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");

function readMaterials(file: string, into: Map<string, string>): void {
  if (!existsSync(file)) return;
  let material = "";
  for (const raw of readFileSync(file, "utf8").split(LINES)) {
    const line = raw.trim();
    if (line.startsWith("newmtl ")) material = line.slice(7).trim();
    else if (line.startsWith("Kd ") && material) into.set(material, `#${line.slice(3).trim().split(SPACES).map(Number).map(hex).join("")}`);
  }
}

/**
 * Yüz yönlerini onarır: bazı modellerde (ör. saç perçemleri) üçgenler içe dönük ya da karışık sarılmış; oyun arka
 * yüzleri çizmediği için bunlar delik gibi görünür. Önce bitişik üçgenler (tam iki üçgenin paylaştığı kenar üzerinden)
 * aynı sarılışa getirilir; sonra her bağlı parça dışa baktırılır: kapalıysa hacmi pozitif olacak, açıksa yüzleri
 * parçanın ortasından dışarı bakacak şekilde. Ters çevrilen üçgen sayısını döner.
 */
export function orientTriangles(verts: readonly Vec[], index: number[]): number {
  const count = index.length / 3;
  const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const edges = new Map<string, number[]>();
  for (let t = 0; t < count; t++)
    for (let e = 0; e < 3; e++) {
      const key = edgeKey(index[t * 3 + e], index[t * 3 + ((e + 1) % 3)]);
      const list = edges.get(key);
      if (list) list.push(t);
      else edges.set(key, [t]);
    }
  const flip = (t: number) => {
    const b = index[t * 3 + 1];
    index[t * 3 + 1] = index[t * 3 + 2];
    index[t * 3 + 2] = b;
  };
  const runs = (t: number, a: number, b: number) => {
    for (let e = 0; e < 3; e++) if (index[t * 3 + e] === a && index[t * 3 + ((e + 1) % 3)] === b) return true;
    return false;
  };

  const component = new Int32Array(count).fill(-1);
  let flipped = 0;
  for (let seed = 0; seed < count; seed++) {
    if (component[seed] >= 0) continue;
    component[seed] = seed;
    const members = [seed];
    const area = (t: number) => {
      const [a, b, c] = [0, 1, 2].map((k) => verts[index[t * 3 + k]]);
      const n = cross(sub(b, a), sub(c, a));
      return Math.sqrt(dot(n, n));
    };
    let keptArea = area(seed);
    let flippedArea = 0;
    for (let q = 0; q < members.length; q++) {
      const t = members[q];
      for (let e = 0; e < 3; e++) {
        const a = index[t * 3 + e];
        const b = index[t * 3 + ((e + 1) % 3)];
        const list = edges.get(edgeKey(a, b))!;
        if (list.length !== 2) continue; // açık kenar ya da üçten çok üçgenin paylaştığı kenar: yön taşınmaz
        const n = list[0] === t ? list[1] : list[0];
        if (component[n] >= 0) continue;
        component[n] = seed;
        // Komşu aynı kenarı aynı yönde dolaşıyorsa sarılışı terstir.
        if (runs(n, a, b)) {
          flip(n);
          flipped++;
          flippedArea += area(n);
        } else keptArea += area(n);
        members.push(n);
      }
    }

    // Dışa baktır.
    let volume = 0;
    let open = false;
    for (const t of members) {
      const [a, b, c] = [0, 1, 2].map((k) => verts[index[t * 3 + k]]);
      volume += dot(a, cross(b, c)) / 6;
      for (let e = 0; e < 3; e++) if (edges.get(edgeKey(index[t * 3 + e], index[t * 3 + ((e + 1) % 3)]))!.length === 1) open = true;
    }
    // Kapalı parçada hacmin işareti kesindir. Açık parçada (ağzı açık halka, pelerin) yüzler parçanın ortasından dışarı
    // bakıyor mu diye bakılır; düz bir şeritte bu kararsız kalır, o zaman modelcinin çoğunlukla verdiği yön korunur.
    let outward = volume;
    if (open || Math.abs(volume) < 1e-12) {
      const mid: Vec = [0, 0, 0];
      for (const t of members) for (let k = 0; k < 3; k++) for (let v = 0; v < 3; v++) mid[v] += verts[index[t * 3 + k]][v] / (3 * members.length);
      let facing = 0;
      let total = 0;
      for (const t of members) {
        const [a, b, c] = [0, 1, 2].map((k) => verts[index[t * 3 + k]]);
        const n = cross(sub(b, a), sub(c, a));
        const away = sub([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], mid);
        const length = Math.sqrt(dot(away, away));
        if (length > 1e-9) facing += dot(n, away) / length;
        total += Math.sqrt(dot(n, n));
      }
      outward = total > 0 && Math.abs(facing / total) > 0.3 ? facing : keptArea - flippedArea;
    }
    if (outward < 0) {
      for (const t of members) flip(t);
      flipped += members.length;
    }
  }
  return flipped;
}

export function parseObj(source: string, scale: number): ObjModel {
  const positions: Vec[] = [];
  const normals: Vec[] = [];
  const raw = new Map<string, { verts: Vec[]; index: number[]; keys: Map<string, number>; material?: string }>();
  const materials = new Map<string, string>();
  let current: string | null = null;
  let flipped = 0;

  for (const text of readFileSync(source, "utf8").split(LINES)) {
    const line = text.trim();
    if (line.startsWith("mtllib ")) readMaterials(resolve(dirname(source), line.slice(7).trim()), materials);
    else if (line.startsWith("usemtl ") && current) raw.get(current)!.material ??= line.slice(7).trim();
    else if (line.startsWith("o ") || line.startsWith("g ")) {
      current = line.slice(2).trim();
      if (!raw.has(current)) raw.set(current, { verts: [], index: [], keys: new Map() });
    } else if (line.startsWith("v ")) {
      const [x, y, z] = line.slice(2).trim().split(SPACES).map(Number);
      positions.push([round(x * scale), round(y * scale), round(z * scale)]);
    } else if (line.startsWith("vn ")) normals.push(line.slice(3).trim().split(SPACES).map(Number) as Vec);
    else if (line.startsWith("f ")) {
      if (!current) throw new Error(`${source}: nesnesiz yüz ('o' satırı yok)`);
      const part = raw.get(current)!;
      const refs = line
        .slice(2)
        .trim()
        .split(SPACES)
        .map((token) => {
          const [v, , n] = token.split("/").map((s) => (s ? Number(s) : NaN));
          return { v: v < 0 ? positions.length + v : v - 1, n: Number.isNaN(n) ? -1 : n < 0 ? normals.length + n : n - 1 };
        });
      for (let k = 1; k + 1 < refs.length; k++) {
        let tri = [refs[0], refs[k], refs[k + 1]];
        const [a, b, c] = tri.map((r) => positions[r.v]);
        const face = cross(sub(b, a), sub(c, a));
        if (dot(face, face) < 1e-12) continue; // sıfır alanlı üçgen
        const given = tri.map((r) => normals[r.n]).find(Boolean);
        if (given && dot(face, given) < 0) {
          tri = [tri[0], tri[2], tri[1]];
          flipped++;
        }
        for (const r of tri) {
          const p = positions[r.v];
          const key = p.join(",");
          let id = part.keys.get(key);
          if (id === undefined) {
            id = part.verts.length;
            part.verts.push(p);
            part.keys.set(key, id);
          }
          part.index.push(id);
        }
      }
    }
  }

  const parts = new Map<string, ObjPart>();
  let triangles = 0;
  for (const [name, part] of raw) {
    if (!part.index.length) continue;
    flipped += orientTriangles(part.verts, part.index);
    triangles += part.index.length / 3;
    parts.set(name, { p: part.verts.flat(), i: part.index, c: materials.get(part.material ?? name) });
  }
  return { parts, triangles, flipped };
}
