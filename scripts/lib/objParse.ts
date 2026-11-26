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
    triangles += part.index.length / 3;
    parts.set(name, { p: part.verts.flat(), i: part.index, c: materials.get(part.material ?? name) });
  }
  return { parts, triangles, flipped };
}
