import { BoxGeometry, BufferGeometry, Group, Mesh, Object3D } from "three";
import { describe, expect, it } from "vitest";
import { PARTS } from "./characterKit";
import { geometriesFromScene, partIdOf } from "./kitModel";

const mesh = (name: string, geometry: BufferGeometry = new BoxGeometry(1, 1, 1)) => {
  const m = new Mesh(geometry);
  m.name = name;
  return m;
};

describe("Blender kiti", () => {
  it("parçayı özelliğinden, adından ya da üstündeki nesneden tanır", () => {
    const tagged = mesh("Cube");
    tagged.userData.oba_parca = "kalkan";
    expect(partIdOf(tagged)).toBe("kalkan");
    expect(partIdOf(mesh("kafa"))).toBe("kafa");
    expect(partIdOf(mesh("kafa001"))).toBe("kafa"); // Blender "kafa.001", glTF yükleyici noktayı atar
    expect(partIdOf(mesh("balta-agzi.002"))).toBe("balta-agzi");
    const parent = new Group();
    parent.name = "yay";
    const child = mesh("Sphere");
    parent.add(child);
    expect(partIdOf(child)).toBe("yay");
    expect(partIdOf(mesh("Cube"))).toBeNull();
  });

  it("dönüşümleri uygular, aynı parçanın ağlarını birleştirir, tanınmayanları atar", () => {
    const scene = new Object3D();
    const a = mesh("kafa");
    a.position.set(0, 3, 0);
    const b = mesh("kafa.001");
    b.position.set(2, 0, 0);
    b.scale.setScalar(2);
    scene.add(a, b, mesh("Cube"));
    const kit = geometriesFromScene(scene);
    expect([...kit.keys()]).toEqual(["kafa"]);
    const head = kit.get("kafa")!;
    expect(head.index).toBeNull();
    expect(head.getAttribute("position").count).toBe(72); // iki kutu × 12 üçgen × 3 köşe
    head.computeBoundingBox();
    expect(head.boundingBox!.max.y).toBeCloseTo(3.5);
    expect(head.boundingBox!.max.x).toBeCloseTo(3);
    expect(head.getAttribute("normal")).toBeDefined();
  });

  it("koddaki kit parçalarıyla aynı sonucu verir (gidiş-dönüş)", () => {
    const scene = new Object3D();
    for (const part of PARTS) scene.add(mesh(part.id, part.geometry));
    const kit = geometriesFromScene(scene);
    expect(kit.size).toBe(PARTS.length);
    for (const part of PARTS) {
      const original = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
      expect(kit.get(part.id)!.getAttribute("position").count).toBe(original.getAttribute("position").count);
    }
  });
});
