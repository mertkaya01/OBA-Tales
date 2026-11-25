// pixelfx çekirdeğinin OBA-Tales sitesinin kullandığı kısmı için TypeScript bildirimi (core/index.js upstream'den).

/** Renk: 0xAABBGGRR (ImageData'nın Uint32 görünümüyle aynı bayt sırası). */
export type PackedColor = number;

/** w × h piksellik çerçeve; sol üst köşesi dünyada (ox, oy). */
export interface Frame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** Opak renkler. */
  color: Uint32Array;
  /** Toplanan ışık (parıltı). */
  light: Uint32Array;
}

/** Karakter siluetinin maskesi (1 = dolu). */
export interface ActorMask {
  w: number;
  h: number;
  data: Uint8Array;
}

/** Efektlerin okuduğu karakter: ayakları (0, 0)'da, yerel koordinatta. */
export interface Actor {
  mask: ActorMask;
  /** Karakterin kendi renkleri, satır satır (boş yerde 0). */
  pixels: Uint32Array;
  /** Maskenin sol üst köşesi. */
  x: number;
  y: number;
  w: number;
  h: number;
  k: number;
  head: [number, number];
  chest: [number, number];
}

export interface EffectMeta {
  name: string;
  desc?: string;
  tags?: string[];
  /** Önerilen tuval boyu. */
  size?: [number, number];
  /** Tuvalde (0, 0) noktasının yeri. */
  origin?: [number, number];
  duration?: number;
  loop?: boolean;
  fps?: number;
  actor?: number;
  options?: Record<string, unknown>;
}

/** Bir efekt modülü (fx/<kategori>/<ad>.js). */
export interface EffectModule {
  meta: EffectMeta;
}

export interface FxOptions {
  x?: number;
  y?: number;
  flip?: boolean;
  angle?: number;
  seed?: number;
  /** Ana renk rampası, koyudan açığa. */
  palette?: readonly string[];
  /** Parıltı gücü. */
  light?: number;
  actor?: Actor;
  [option: string]: unknown;
}

/** Canlı efekt örneği. */
export interface FxInstance {
  readonly meta: EffectMeta;
  /** Varsayılanlarla birleşmiş ayarlar; çizim her karede buradan okur (x, y, flip değiştirilebilir). */
  readonly options: FxOptions;
  readonly t: number;
  update(dt: number): void;
  /** "back": karakterin arkası, "front": önü; verilmezse ikisi. */
  draw(frame: Frame, layer?: "back" | "front"): void;
  /** Bitmesine izin ver: döngüler söner, tek seferlikler kısalır. */
  stop(): void;
  done(): boolean;
}

export declare function createFrame(w: number, h: number, ox?: number, oy?: number): Frame;
export declare function clearFrame(frame: Frame): Frame;
export declare function createFx(module: EffectModule, options?: FxOptions): FxInstance;
/** Çerçeveyi RGBA baytlara çevirir; bg null ise saydam (ışık, alfa ile toplanır). */
export declare function composite<T extends Uint8ClampedArray>(frame: Frame, out: T, bg?: null | number | Uint32Array, lightK?: number): T;
/** "#rrggbb" → paketlenmiş renk. */
export declare function hex(color: string): PackedColor;
export declare function stockActor(k?: number): Actor;
