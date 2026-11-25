// pixelfx piksel fontları için TypeScript bildirimi (core/font.js upstream'den).

export type FontName = "mini" | "big";

/** Yazının font pikseli cinsinden genişliği (büyütmeden önce). */
export declare function textWidth(str: string, font?: FontName): number;

/** Yazının mürekkepli her pikseli için plot(x, y) çağırır; yazının sol üstü (0, 0). */
export declare function rasterText(str: string, font: FontName, plot: (x: number, y: number) => void): void;

export declare const FONTS: Readonly<Record<FontName, { h: number; space: number; gap: number }>>;
