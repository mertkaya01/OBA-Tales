/**
 * OBA-TALES PALETİ — piksel karakterler, arazi ve efektler için ortak renkler.
 *
 * Arayüz renkleri src/index.css token'larındadır; buradaki nadirlik ve sınıf renkleri onlarla aynı tutulur.
 * Canvas, Three.js ve PixiJS doğrudan bu değerleri kullanır.
 */
import type { ClassId, Rarity } from "../types";

export type Rgba = readonly [r: number, g: number, b: number, a: number];

/** "#c4413a" → [196, 65, 58, 255] */
export function hexToRgba(hex: string, alpha = 255): Rgba {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((ch) => ch + ch).join("") : value;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Bütün karakterlerde ortak kullanılan sabit renkler. */
export const BASE_COLORS = {
  outline: "#1b1424",
  eye: "#1b1424",
  fur: "#efe6d4",
  leather: "#7a4a26",
  pants: "#3b3046",
  boots: "#4a2f1d",
  ivory: "#f1e9d2",
  glow: "#ffd76a",
  glowBright: "#fff6cf",
  drumSkin: "#e6d6b8",
  gold: "#edbd45",
} as const;

/** Ten renkleri: [ana, gölge] */
export const SKIN_TONES: readonly (readonly [string, string])[] = [
  ["#f6d2b5", "#e0ab8a"],
  ["#eebd94", "#d39a6f"],
  ["#d9a172", "#b97e52"],
  ["#b8794c", "#94603a"],
  ["#8d5a3b", "#6e432a"],
];

export const HAIR_COLORS: readonly string[] = [
  "#2b1d16",
  "#4a2e1c",
  "#7a4a26",
  "#b07a3c",
  "#d9b26a",
  "#e8e2d5",
  "#8a2f2a",
  "#3a3a4a",
];

/** Sıradan karakterlerin atkı renkleri (nadir ve üstünde atkı nadirlik rengini alır). */
export const SCARF_COLORS: readonly string[] = ["#c4413a", "#e8a83c", "#3f8cc4", "#7fbf6a", "#d96aa0", "#efe6d4", "#5a7f6b"];

/** Sınıfa göre kıyafet seçenekleri: [ana, gölge] */
export const CLASS_CLOTH: Readonly<Record<ClassId, readonly (readonly [string, string])[]>> = {
  kalkaneri: [
    ["#8c3b2f", "#6b2b22"],
    ["#7a4a2a", "#5a351e"],
    ["#5a4a7a", "#433759"],
  ],
  okyeli: [
    ["#3f6f8a", "#2e5268"],
    ["#4f7a5a", "#3a5a42"],
    ["#6a5a3e", "#4d412c"],
  ],
  ocakcan: [
    ["#a8642e", "#824b21"],
    ["#8a5a8a", "#684368"],
    ["#5a7f6b", "#43604f"],
  ],
};

/** Sınıfa göre metal: Kalkaneri pirinç, Okyeli gümüş, Ocakcan bakır. [ana, parlak] */
export const CLASS_METAL: Readonly<Record<ClassId, readonly [string, string]>> = {
  kalkaneri: ["#c9933a", "#f6d36f"],
  okyeli: ["#9fb4c4", "#e6f1f8"],
  ocakcan: ["#b8683a", "#f0a36b"],
};

/** index.css içindeki --color-kalkaneri/okyeli/ocakcan ile aynı. */
export const CLASS_COLORS: Readonly<Record<ClassId, string>> = {
  kalkaneri: "#d0503f",
  okyeli: "#4aa6cf",
  ocakcan: "#e8a83c",
};

/** index.css içindeki --color-siradan/nadir/destansi/efsanevi/ulu/goksel ile aynı. */
export const RARITY_COLORS: Readonly<Record<Rarity, string>> = {
  siradan: "#b8a888",
  nadir: "#34b08b",
  destansi: "#9566e0",
  efsanevi: "#f0642f",
  ulu: "#ffd23f",
  goksel: "#7fe6ff",
};

/** Pelerin renkleri: Ocakcan'ın yumuşak pelerini (sıradan/nadir), destansı mor, efsanevi kızıl, ulu altın, göksel gece mavisi. */
export const CAPE_COLORS: Readonly<Record<Rarity, string>> = {
  siradan: "#5a7f6b",
  nadir: "#2a9677",
  destansi: "#6a43b8",
  efsanevi: "#b8332c",
  ulu: "#c9971f",
  goksel: "#1c2a66",
};

export const AURA_COLORS = {
  alev: "#ff8a3d",
  isik: "#d6f1ff",
  destansi: "#9566e0",
  efsanevi: "#f0642f",
  ulu: "#ffd23f",
  goksel: "#7fe6ff",
} as const;

/** Arazi boyama renkleri (kuşbakışı harita ve 3D ada). */
export const TERRAIN_COLORS = {
  deepSea: "#0b2440",
  sea: "#123a5e",
  shallow: "#2d6f8f",
  foam: "#cfe8f2",
  sand: "#d9c79a",
  grassLow: "#6f9a5a",
  grassHigh: "#a7bf7a",
  frost: "#dfeef2",
  rock: "#8a8f9a",
  ice: "#bfe1f0",
  snow: "#f4f8fb",
  temple: "#e2b23c",
  // Sığlık basamakları (kıyıdan açığa) ve açık deniz
  shoal: "#6bbde3",
  shelf: "#4596cc",
  shelfDeep: "#2f72ad",
  openSea: "#1c4a85",
  // Kara
  highland: "#d3c994",
  forest: "#4f8049",
  coastInk: "#1d2a35",
  trail: "#b49d78",
  // Tatlı su
  river: "#3f8fd2",
  riverIce: "#c3e4f3",
  lake: "#3a84c6",
  lakeIce: "#d6edf7",
} as const;
