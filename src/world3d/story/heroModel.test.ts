import { Color, MeshBasicMaterial, MeshLambertMaterial, type Mesh, type SkinnedMesh } from "three";
import { resolveLook } from "../../game/sprites/composeSprite";
import { describe, expect, it } from "vitest";
import { CAST } from "../../content/cast";
import { ARRIVAL_ORDER } from "../../content/story";
import { PARTS } from "../characters/characterKit";
import { dressHero, HERO_CLIPS, parseHeroModel } from "./heroModel";

const PART_IDS = new Set(PARTS.map((p) => p.id));

// Uygulamanın tsconfig'inde Node tipleri yok (tarayıcı kodu); dosya okuyucu testte gevşek tiple yüklenir.
const { readFileSync } = (await import(/* @vite-ignore */ `node:${"fs"}`)) as { readFileSync: (path: string) => Uint8Array };

function readGlb(id: string) {
  const bytes = readFileSync(`public/models/kahraman-${id}.glb`);
  const jsonLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
    animations: { name: string }[];
    materials: { name: string }[];
    skins: { joints: number[] }[];
  };
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { json, data };
}

describe("kahraman modelleri (npm run blender:kahramanlar)", () => {
  it.each(ARRIVAL_ORDER)("%s: 13 klip, tek iskelet, her parça oyundaki listede", (id) => {
    const { json } = readGlb(id);
    expect(json.animations.map((a) => a.name).sort()).toEqual([...HERO_CLIPS].sort());
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0].joints.length).toBeGreaterThanOrEqual(18);
    const unknown = json.materials.map((m) => m.name).filter((name) => !PART_IDS.has(name));
    expect(unknown).toEqual([]);
  });

  it("yüklenince kopyalanabilir ve oyunun boyasıyla giydirilir", async () => {
    const { data } = readGlb("bintas");
    const model = await parseHeroModel(data);
    expect([...model.clips.keys()].sort()).toEqual([...HERO_CLIPS].sort());

    const hero = CAST.find((c) => c.id === "bintas");
    if (!hero) throw new Error("BinTaş kadroda yok");
    const a = model.instantiate();
    const b = model.instantiate();
    const before: Mesh[] = [];
    b.traverse((o) => {
      if ((o as Mesh).isMesh) before.push(o as Mesh);
    });
    const materials = dressHero(a, hero);

    // 45 renk parçası iki çizime iner: gövde ve kendi ışığıyla parlayanlar.
    const meshes: Mesh[] = [];
    a.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    expect(meshes.every((m) => (m as SkinnedMesh).isSkinnedMesh)).toBe(true);
    expect(meshes.map((m) => m.userData.oba).sort()).toEqual(["govde", "govde-parilti"]);
    expect(materials).toHaveLength(2);
    const body = meshes.find((m) => m.userData.oba === "govde")!;
    const glow = meshes.find((m) => m.userData.oba === "govde-parilti")!;
    expect(body.material).toBeInstanceOf(MeshLambertMaterial);
    expect(body.castShadow).toBe(true);
    expect(glow.material).toBeInstanceOf(MeshBasicMaterial); // alev küresi kendi ışığıyla parlar
    expect(glow.castShadow).toBe(false);

    // Renkler oyundaki parça listesinden: eteğin rengi gövdenin köşe renklerinde var.
    const skirt = new Color(PARTS.find((p) => p.id === "bintas-etek")!.color(resolveLook(hero), hero));
    const colors = body.geometry.getAttribute("color");
    let found = false;
    for (let i = 0; i < colors.count && !found; i++) found = Math.abs(colors.getX(i) - skirt.r) < 1e-4 && Math.abs(colors.getY(i) - skirt.g) < 1e-4 && Math.abs(colors.getZ(i) - skirt.b) < 1e-4;
    expect(found).toBe(true);

    // Öbür kopya etkilenmez.
    const after: Mesh[] = [];
    b.traverse((o) => {
      if ((o as Mesh).isMesh) after.push(o as Mesh);
    });
    expect(after).toEqual(before);
    expect(after.length).toBeGreaterThan(10);
  });
});

describe("hayvan modelleri (npm run blender:hayvanlar)", () => {
  it.each(["geyik", "tavsan", "kus"] as const)("%s: beş klip, tek iskelet", async (kind) => {
    const bytes = readFileSync(`public/models/hayvan-${kind}.glb`);
    const jsonLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as { animations: { name: string }[]; skins: unknown[] };
    const { ANIMALS } = await import("./animals");
    expect(json.animations.map((a) => a.name).sort()).toEqual(Object.keys(ANIMALS[kind].lengths).sort());
    expect(json.skins).toHaveLength(1);
  });
});
