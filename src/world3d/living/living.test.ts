import { describe, expect, it } from "vitest";
import { CAST } from "../../content/cast";
import { ISLAND_IDS } from "../../content/islands";
import { REGIONS } from "../../content/regions";
import { generateTerrain, sampleHeightBilinear, sampleTerrain } from "../../game/terrain";
import { createStarterCharacter } from "../../lib/rules";
import { BOSS_IDS, PLACE_IDS, REGION_IDS } from "../../types";
import type { Character, Platform, Rarity } from "../../types";
import { LANDMARKS, isExcluded, placeAnchors, structureObstacles } from "../layout";
import { groundY } from "../worldScale";
import { CHEER_PERIOD, cyclePeriod, motionAt, type MotionParams } from "./motion";
import { currentPosition, placeCharacters, safeRadius } from "./placement";
import { BOSS_HEIGHT, COLUMN_SPACING, RAID_GROUNDS, ROW_SPACING, parseBossPreview, planFormation } from "./raid";
import {
  SUNRISE,
  SUNSET,
  currentWorldHour,
  dayPhase,
  formatHour,
  lightDirectionAt,
  parseHourOverride,
  seasonDay,
  skyAt,
  worldHour,
} from "./sky";

const SEED = 20261124;
const terrain = generateTerrain({ seed: SEED });
const AYAZ_SQUARE = RAID_GROUNDS.ayazbogazi.square;
const now = new Date("2026-11-25T12:00:00Z");

let counter = 0;
const follower = (platform: Platform, rarity: Rarity = "siradan", coordinates = { ...AYAZ_SQUARE }): Character => ({
  ...createStarterCharacter({ handle: `akinci_${counter++}`, platform, region: "ayazbogazi", coordinates, now }),
  rarity,
});

// ── Gökyüzü ────────────────────────────────────────────────────────

describe("gün ve gece", () => {
  it("öğlen güneş güçlü ve güneyden, gece ay ışığı zayıf ve fenerler yanık", () => {
    const noon = skyAt(12);
    expect(noon.source).toBe("gunes");
    expect(noon.lightIntensity).toBeGreaterThan(2.4);
    expect(noon.lamp).toBe(0);
    expect(noon.lightDirection[2]).toBeGreaterThan(0.5); // +z = güney
    const night = skyAt(23);
    expect(night.source).toBe("ay");
    expect(night.lightIntensity).toBeLessThan(1);
    expect(night.lamp).toBe(1);
  });

  it("güneş doğudan doğar, batıdan batar; ışık yönü birim vektör ve hep ufkun üstünde", () => {
    expect(lightDirectionAt(SUNRISE + 0.1).direction[0]).toBeGreaterThan(0.6);
    expect(lightDirectionAt(SUNSET - 0.1).direction[0]).toBeLessThan(-0.6);
    for (let h = 0; h < 24; h += 0.25) {
      const [x, y, z] = lightDirectionAt(h).direction;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1);
      expect(y).toBeGreaterThan(0.15);
    }
  });

  it("geçişler yumuşak: çeyrek saatte ışık ani sıçramaz, gece yarısı kesintisiz", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const a = skyAt(h);
      const b = skyAt(h + 0.25);
      expect(Math.abs(a.lightIntensity - b.lightIntensity), `saat ${h}`).toBeLessThan(0.45);
      expect(Math.abs(a.lamp - b.lamp)).toBeLessThan(0.3);
    }
    expect(skyAt(24).lightIntensity).toBeCloseTo(skyAt(0).lightIntensity);
    // Güneşten aya geçerken ışık neredeyse sönük: yön değişimi görünmez.
    expect(skyAt(SUNRISE).lightIntensity).toBeLessThan(0.1);
    expect(skyAt(SUNSET).lightIntensity).toBeLessThan(0.1);
  });

  it("gün evreleri ve saat biçimi", () => {
    expect(dayPhase(6)).toBe("safak");
    expect(dayPhase(9)).toBe("sabah");
    expect(dayPhase(13)).toBe("ogle");
    expect(dayPhase(16.5)).toBe("ikindi");
    expect(dayPhase(19)).toBe("aksam");
    expect(dayPhase(2)).toBe("gece");
    expect(formatHour(19.5)).toBe("19:30");
    expect(formatHour(24.25)).toBe("00:15");
  });

  it("adalar saati İstanbul saatidir; ?saat= ve hızlı zaman ayarları", () => {
    expect(worldHour(now)).toBeCloseTo(15); // 12:00 UTC = 15:00 İstanbul
    expect(parseHourOverride("?saat=21")).toBe(21);
    expect(parseHourOverride("?k=baturay&saat=6:30")).toBe(6.5);
    expect(parseHourOverride("?saat=25")).toBeNull();
    expect(parseHourOverride("?saat=aksam")).toBeNull();
    expect(currentWorldHour(now.getTime(), { override: 21, lapse: null })).toBe(21);
    const start = now.getTime();
    expect(currentWorldHour(start + 30_000, { override: null, lapse: { startedAt: start, startHour: 22 } })).toBeCloseTo(4);
  });

  it("sezon günü ilk bölümün yayınından sayılır", () => {
    expect(seasonDay("2026-11-10T19:00:00+03:00", now.getTime())).toBe(15);
    expect(seasonDay(null, now.getTime())).toBeNull();
    expect(seasonDay("2026-12-01T19:00:00+03:00", now.getTime())).toBeNull();
  });
});

// ── Hareket ────────────────────────────────────────────────────────

describe("kalabalık hareketi", () => {
  const walker: MotionParams = { radius: 9, seed: 0.37, yaw: 0.2, cheer: -1 };

  it("gezgin hiçbir an yarıçapının dışına çıkmaz ve kesintisiz yürür", () => {
    let prev = motionAt(walker, 0);
    let prevPos = { x: prev.dx, z: prev.dz };
    let walked = 0;
    for (let t = 0.05; t < 200; t += 0.05) {
      const s = motionAt(walker, t);
      expect(Math.hypot(s.dx, s.dz)).toBeLessThanOrEqual(walker.radius + 1e-6);
      const step = Math.hypot(s.dx - prevPos.x, s.dz - prevPos.z);
      expect(step, `t=${t.toFixed(2)}`).toBeLessThan(0.5); // ≤ 10 birim/sn
      walked += step;
      // Yön de sıçramaz (yalnızca ±π sarmasında).
      const dYaw = Math.abs(Math.atan2(Math.sin(s.yaw - prev.yaw), Math.cos(s.yaw - prev.yaw)));
      expect(dYaw, `t=${t.toFixed(2)}`).toBeLessThan(0.6);
      prev = s;
      prevPos = { x: s.dx, z: s.dz };
    }
    expect(walked).toBeGreaterThan(30);
  });

  it("dururken kameraya, yürürken gittiği yöne bakar", () => {
    const period = cyclePeriod(walker.seed);
    const base = Math.floor(walker.seed * 5) - walker.seed * 5; // u = t/T + seed*5 → f = 0 olan an
    const at = (f: number) => (base + 3 + f) * period;
    const idle = motionAt(walker, at(0.3));
    expect(idle.walk).toBe(0);
    expect(idle.yaw).toBeCloseTo(walker.yaw);
    const moving = motionAt(walker, at(0.75));
    expect(moving.walk).toBe(1);
    const ahead = motionAt(walker, at(0.76));
    const heading = Math.atan2(ahead.dx - moving.dx, ahead.dz - moving.dz);
    expect(Math.cos(heading - moving.yaw)).toBeGreaterThan(0.99);
  });

  it("yerinde duranlar kımıldamaz; akıncılar nara atar", () => {
    const still = motionAt({ radius: 0, seed: 0.5, yaw: 1, cheer: -1 }, 123.4);
    expect([still.dx, still.dz, still.hop, still.walk, still.yaw]).toEqual([0, 0, 0, 0, 1]);
    const raider: MotionParams = { radius: 0, seed: 0.5, yaw: Math.PI, cheer: 0.36 };
    const hops = Array.from({ length: 700 }, (_, i) => motionAt(raider, i * 0.01).hop);
    expect(Math.max(...hops)).toBeGreaterThan(1);
    expect(hops.filter((h) => h > 0).length).toBeLessThan(hops.length * 0.2);
    // Arka sıra öndekinden sonra zıplar.
    expect(motionAt(raider, 0.36 + 0.2).hop).toBeGreaterThan(0);
    expect(motionAt({ ...raider, cheer: 0.6 }, 0.36 + 0.2).hop).toBe(0);
    expect(motionAt(raider, 0.36 + CHEER_PERIOD + 0.2).hop).toBeCloseTo(motionAt(raider, 0.56).hop);
  });
});

// ── Akın meydanı ───────────────────────────────────────────────────

describe("akın meydanı", () => {
  it("her bölgenin meydanı ve odak noktası karada, meydan kendi bölgesinde ve yapılardan uzak", () => {
    const obstacles = structureObstacles(terrain, SEED);
    for (const id of REGION_IDS) {
      const { square, focus } = RAID_GROUNDS[id];
      expect(sampleTerrain(terrain, square).region, id).toBe(id);
      expect(sampleHeightBilinear(terrain, square), id).toBeGreaterThan(0.06);
      expect(sampleHeightBilinear(terrain, focus), `${id} odak`).toBeGreaterThan(0.06);
      for (const o of obstacles) expect(Math.hypot(o.x - square.x, o.y - square.y), `${id} yapı`).toBeGreaterThan(o.r + 12);
      // Meydan ağaçsız bırakılır.
      expect(isExcluded(square)).toBe(true);
    }
  });

  const participants = [
    ...CAST.slice(0, 3),
    ...Array.from({ length: 30 }, () => follower("instagram")),
    ...Array.from({ length: 22 }, () => follower("youtube")),
    ...Array.from({ length: 35 }, (_, i) => follower("tiktok", i === 0 ? "efsanevi" : "siradan")),
  ];
  const formation = planFormation(participants, "ayazbogazi");
  const ground = RAID_GROUNDS.ayazbogazi;
  const forward = (() => {
    const dx = ground.focus.x - ground.square.x;
    const dy = ground.focus.y - ground.square.y;
    const l = Math.hypot(dx, dy);
    return { x: dx / l, y: dy / l };
  })();
  const along = (id: string) => {
    const s = formation.slots.get(id)!;
    return (s.x - ground.square.x) * forward.x + (s.y - ground.square.y) * forward.y;
  };

  it("herkesin bir yeri var; kimse üst üste durmuyor", () => {
    expect(formation.slots.size).toBe(participants.length);
    const slots = [...formation.slots.values()];
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y)).toBeGreaterThan(Math.min(COLUMN_SPACING, ROW_SPACING) - 0.01);
      }
    }
  });

  it("öncüler en önde, kalkanlar önde, davullar ortada, yaylar arkada", () => {
    const front = (ids: string[]) => Math.min(...ids.map(along));
    const back = (ids: string[]) => Math.max(...ids.map(along));
    const ids = (pred: (c: Character) => boolean) => participants.filter(pred).map((c) => c.id);
    const leaders = ids((c) => c.roleType !== "follower");
    const shields = ids((c) => c.roleType === "follower" && c.class.id === "kalkaneri");
    const drums = ids((c) => c.roleType === "follower" && c.class.id === "ocakcan");
    const bows = ids((c) => c.roleType === "follower" && c.class.id === "okyeli");
    expect(front(leaders)).toBeGreaterThan(back(shields));
    expect(front(shields)).toBeGreaterThan(back(drums));
    expect(front(drums)).toBeGreaterThan(back(bows));
    // Bloğun içinde efsanevi önde.
    const legend = participants.find((c) => c.class.id === "okyeli" && c.rarity === "efsanevi")!;
    expect(along(legend.id)).toBeCloseTo(back(bows));
  });

  it("saf boss'a bakar, meydanın ortasında durur ve karada kalır", () => {
    expect(Math.sin(formation.facing)).toBeCloseTo(forward.x);
    expect(Math.cos(formation.facing)).toBeCloseTo(forward.y);
    const slots = [...formation.slots.values()];
    const cx = slots.reduce((s, p) => s + p.x, 0) / slots.length;
    const cy = slots.reduce((s, p) => s + p.y, 0) / slots.length;
    expect(Math.hypot(cx - ground.square.x, cy - ground.square.y)).toBeLessThan(ROW_SPACING * 1.5);
    for (const s of slots) {
      expect(sampleHeightBilinear(terrain, s)).toBeGreaterThan(0.05);
      expect(Math.hypot(s.x - ground.square.x, s.y - ground.square.y)).toBeLessThanOrEqual(formation.radius);
    }
  });
});

// ── Yerleşim ───────────────────────────────────────────────────────

describe("yerleşim", () => {
  const obstacles = structureObstacles(terrain, SEED);

  it("gezinme yarıçapı denize, yamaca ve yapılara taşmaz", () => {
    // Fenerin dibinde: yapının içinde → hiç gezinmez.
    expect(safeRadius(terrain, LANDMARKS.fener, 10, obstacles)).toBe(0);
    // Akınburnu'nun açık çayırı: geniş tur.
    // Akınburnu akın meydanı: düz ve yapısız.
    const meadow = { x: RAID_GROUNDS.akinburnu.square.x, y: RAID_GROUNDS.akinburnu.square.y + 10 };
    const r = safeRadius(terrain, meadow, 10, obstacles);
    expect(r).toBeGreaterThan(0);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const p = { x: meadow.x + Math.cos(a) * r, y: meadow.y + Math.sin(a) * r };
      expect(sampleHeightBilinear(terrain, p)).toBeGreaterThan(0.04);
      for (const o of obstacles) expect(Math.hypot(o.x - p.x, o.y - p.y)).toBeGreaterThan(o.r - 2.1);
    }
  });

  const raiders = [follower("instagram"), follower("tiktok"), follower("youtube")];
  // Evi meydanın tam ortasında olan ama akına katılmayan biri.
  const bystander = follower("tiktok", "siradan", { x: AYAZ_SQUARE.x + 2, y: AYAZ_SQUARE.y + 2 });
  const wanderers = Array.from({ length: 40 }, (_, i) =>
    createStarterCharacter({ handle: `gezgin_${i}`, platform: "youtube", region: "akinburnu", coordinates: { x: REGIONS.akinburnu.center.x + 20 + (i % 8) * 6, y: REGIONS.akinburnu.center.y - 20 + Math.floor(i / 8) * 8 }, now }),
  );
  const formation = planFormation(raiders, "ayazbogazi");
  const placements = placeCharacters([...raiders, bystander, ...wanderers, ...CAST], terrain, { obstacles, formation });

  it("akıncılar saflarında, boss'a dönük ve gezinmeden durur", () => {
    for (const c of raiders) {
      const p = placements.get(c.id)!;
      expect(p.inFormation).toBe(true);
      expect(p.home).toEqual({ x: formation.slots.get(c.id)!.x, y: formation.slots.get(c.id)!.y });
      expect(p.motion.radius).toBe(0);
      expect(p.motion.cheer).toBeGreaterThanOrEqual(0);
      expect(p.motion.yaw).toBeCloseTo(formation.facing);
    }
  });

  it("meydanda evi olan seyirci kenara çekilir; gezginlerin bir kısmı yerinde durur", () => {
    const p = placements.get(bystander.id)!;
    expect(p.inFormation).toBe(false);
    const sq = formation.ground.square;
    expect(Math.hypot(p.home.x - sq.x, p.home.y - sq.y)).toBeGreaterThan(formation.radius);
    const radii = wanderers.map((c) => placements.get(c.id)!.motion.radius);
    expect(radii.some((r) => r === 0)).toBe(true);
    expect(radii.some((r) => r >= 4)).toBe(true);
    expect(Math.max(...radii)).toBeLessThanOrEqual(12);
  });

  it("şu anki konum hareketle evin toplamı ve zemine basar", () => {
    const c = wanderers.find((w) => placements.get(w.id)!.motion.radius > 0)!;
    const pl = placements.get(c.id)!;
    for (const t of [0, 7.3, 42, 300]) {
      const pos = currentPosition(pl, terrain, t);
      const m = motionAt(pl.motion, t);
      expect(pos.x).toBeCloseTo(pl.home.x + m.dx);
      expect(pos.z).toBeCloseTo(pl.home.y + m.dz);
      expect(pos.y).toBeCloseTo(groundY(terrain, { x: pos.x, y: pos.z }) + m.hop);
    }
  });
});

describe("boss önizleme", () => {
  it("?boss= yalnızca geçerli boss kimliklerini kabul eder; her boss'un boyu tanımlı", () => {
    expect(parseBossPreview("?boss=ayazkurt")).toBe("ayazkurt");
    expect(parseBossPreview("?saat=21&boss=sisci_karacay")).toBe("sisci_karacay");
    expect(parseBossPreview("?boss=ejderha")).toBeNull();
    expect(parseBossPreview("")).toBeNull();
    for (const id of BOSS_IDS) expect(BOSS_HEIGHT[id]).toBeGreaterThan(15);
  });
});

describe("yer etiketleri", () => {
  it("her yerin etiketi kendi yapısının yanında ve karada", () => {
    const anchors = placeAnchors(terrain);
    for (const [id, anchor] of Object.entries(anchors)) {
      expect(anchor.lift, id).toBeGreaterThan(3);
      expect(anchor.point.x).toBeGreaterThan(0);
      // İskele, batık gemi ve ada etiketleri suyun üstünde olabilir (ada etiketleri terrain.test.ts'te).
      if (!["iskele", "batik_gemi", ...ISLAND_IDS].includes(id)) expect(sampleHeightBilinear(terrain, anchor.point), id).toBeGreaterThan(0);
    }
    expect(Object.keys(anchors)).toHaveLength(PLACE_IDS.length);
    expect(REGIONS.ayazbogazi.center).toBeDefined();
  });
});
