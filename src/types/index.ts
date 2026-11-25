/** Tüm tipler ve sabitler tek noktadan: import { type Character, RARITIES } from '../types' */
export * from './world';
export * from './character';
export * from './season';
export * from './filters';

/**
 * Kimliğe göre anahtarlanmış katalog (src/content içinde kullanılır).
 * Her anahtar, nesnenin `id` alanıyla aynı olmak zorundadır ve hiçbir kimlik eksik kalamaz;
 * aksi halde TypeScript derlemesi hata verir.
 */
export type Catalog<K extends string, T extends { id: string }> = { readonly [P in K]: T & { id: P } };
