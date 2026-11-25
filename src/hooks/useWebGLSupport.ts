/**
 * Tarayıcı WebGL destekliyor mu? Desteklemiyorsa Dünya (3D) görünümü yerine Harita açılır.
 * Sonuç bir kez hesaplanır; deneme için açılan bağlam hemen serbest bırakılır.
 */
import { useState } from "react";

let cached: boolean | null = null;

export function detectWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    cached = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

export function useWebGLSupport(): boolean {
  const [supported] = useState(detectWebGL);
  return supported;
}
