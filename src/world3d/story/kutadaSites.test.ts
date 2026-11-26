import { describe, expect, it } from "vitest";
import { REGIONS } from "../../content/regions";
import { ARRIVAL_ORDER } from "../../content/story";
import { getTerrain } from "../../game/terrainCache";
import { isWet } from "../../game/terrain";
import { createVisibility, isHiddenAt } from "../../game/visibility";
import { distance, pointInPolygon } from "../../lib/geometry";
import type { Coordinates } from "../../types";
import { structureObstacles } from "../layout";
import { kutadaSites } from "./kutadaSites";
import { findWalk, isWalkable, walkLength } from "./walkGrid";

const SEED = 20261124;
const terrain = getTerrain(SEED);
const sites = kutadaSites(terrain, SEED);
const day1 = createVisibility(["kutada"], []);

const valid = (p: Coordinates, label: string) => {
  expect(pointInPolygon(p, REGIONS.kutada.polygon), `${label} Kutada dışında`).toBe(true);
  expect(isWet(terrain, p), `${label} ıslak`).toBe(false);
  expect(isHiddenAt(terrain, day1, p), `${label} karanlıkta`).toBe(false);
};

const structures = structureObstacles(terrain, SEED).filter((o) => distance(o, sites.center) < 320);

describe("Kutada'nın iş yerleri", () => {
  it("her şey bulunur ve kuru, Kutada'nın içinde", () => {
    expect(sites.trees).toHaveLength(12);
    expect(sites.bushes).toHaveLength(8);
    expect(sites.herbs).toHaveLength(10);
    expect(sites.meadow.spots.length).toBeGreaterThanOrEqual(7);
    const all: [Coordinates, string][] = [
      [sites.cauldronSpot.at, "kazan"],
      [sites.fireSpot.at, "ocak"],
      [sites.stack, "istif"],
      [sites.stackSpot.at, "istif önü"],
      [sites.water.at, "dere"],
      [sites.rack, "sehpa"],
      ...sites.trees.flatMap((t, i): [Coordinates, string][] => [
        [t.trunk, `ağaç ${i}`],
        [t.spot.at, `ağaç ${i} kesme yeri`],
        [t.logs, `ağaç ${i} odunları`],
      ]),
      ...sites.bushes.map((b, i): [Coordinates, string] => [b.target, `çalı ${i}`]),
      ...sites.herbs.map((b, i): [Coordinates, string] => [b.target, `ot ${i}`]),
      ...sites.meadow.spots.map((s, i): [Coordinates, string] => [s.at, `çayır ${i}`]),
    ];
    for (const [p, label] of all) valid(p, label);
  });

  it("her kahramanın kendi çadırı ve ocağa bakan oturağı var", () => {
    const tents = ARRIVAL_ORDER.map((id) => sites.homes[id].tent);
    expect(new Set(tents.map((t) => `${t.x},${t.y}`)).size).toBe(ARRIVAL_ORDER.length);
    for (const id of ARRIVAL_ORDER) {
      const home = sites.homes[id];
      valid(home.front, `${id} kapı önü`);
      expect(distance(home.front, sites.fire)).toBeGreaterThan(13);
      // Oturak ocağın çevresinde, ateşin içinde değil; yüzü ocağa dönük.
      const d = distance(home.seat.at, sites.fire);
      expect(d).toBeGreaterThan(8);
      expect(d).toBeLessThan(15);
      const look = { x: Math.sin(home.seat.yaw), y: Math.cos(home.seat.yaw) };
      const toFire = { x: (sites.fire.x - home.seat.at.x) / d, y: (sites.fire.y - home.seat.at.y) / d };
      expect(look.x * toFire.x + look.y * toFire.y).toBeGreaterThan(0.99);
    }
    const seats = ARRIVAL_ORDER.map((id) => sites.homes[id].seat.at);
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) expect(distance(seats[i], seats[j])).toBeGreaterThanOrEqual(5.5);
  });

  it("koru, çalılar ve otlar yapılardan uzak", () => {
    const obstacles = structureObstacles(terrain, SEED);
    for (const p of [...sites.trees.map((t) => t.trunk), ...sites.bushes.map((b) => b.target), ...sites.herbs.map((h) => h.target)]) {
      for (const o of obstacles) expect(distance(o, p)).toBeGreaterThan(o.r + 2);
    }
  });

  it("yürüyüş yolları çadırlara, ağaçlara ve suya girmez", () => {
    const places = [
      sites.homes.mhellingtr.front,
      sites.homes.bintas.seat.at,
      sites.trees[3].spot.at,
      sites.trees[7].logSpot.at,
      sites.stackSpot.at,
      sites.bushes[2].at,
      sites.herbs[5].at,
      sites.meadow.spots[1].at,
      sites.water.at,
      sites.rackSpot.at,
    ];
    for (const a of places) {
      for (const b of places) {
        if (a === b) continue;
        const path = findWalk(sites.grid, a, b);
        expect(path[0]).toBe(a);
        expect(path[path.length - 1]).toBe(b);
        expect(walkLength(path)).toBeLessThan(distance(a, b) * 2 + 30);
        // Uçların hemen çevresi dışında yol yapılara (çadır, ocak, kazan…) ve suya girmez.
        for (let i = 1; i < path.length; i++) {
          const p = path[i - 1];
          const q = path[i];
          const steps = Math.ceil(distance(p, q) / 0.5);
          for (let s = 0; s <= steps; s++) {
            const r = { x: p.x + ((q.x - p.x) * s) / steps, y: p.y + ((q.y - p.y) * s) / steps };
            if (distance(r, a) < 3 || distance(r, b) < 3) continue;
            expect(isWet(terrain, r), `${JSON.stringify(r)} ıslak`).toBe(false);
            for (const o of structures) if (distance(o, r) <= o.r + 0.3) throw new Error(`yol ${JSON.stringify(r)} yapıya giriyor (${o.x},${o.y} r${o.r})`);
          }
          // Köşe noktaları (uçlar hariç) yürünebilir hücrelerde.
          if (i < path.length - 1) expect(isWalkable(sites.grid, q)).toBe(true);
        }
      }
    }
  });
});
