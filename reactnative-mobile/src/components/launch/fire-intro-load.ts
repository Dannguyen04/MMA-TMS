/**
 * Puts the intro textures where expo-gl can read them.
 *
 * On device expo-gl only loads a texture from a `file://` path. A release
 * Android build packs bundled images as drawables, which it cannot read, so the
 * textures ship as base64 in JS (`fire-intro-textures.ts`) and are written to
 * the cache once. On web they become image elements.
 */
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

import type { FireTextures, TextureSource } from "./fire-intro-scene";
import { INTRO_GLOW_PNG, INTRO_ICON_JPG, INTRO_MASK_PNG } from "./fire-intro-textures";

const PARTS = [
  { key: "icon", name: "icon.jpg", mime: "image/jpeg", data: INTRO_ICON_JPG },
  { key: "nameMask", name: "name-mask.png", mime: "image/png", data: INTRO_MASK_PNG },
  { key: "nameGlow", name: "name-glow.png", mime: "image/png", data: INTRO_GLOW_PNG },
] as const;

/** Decoded size of a base64 string. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

function loadWebImage(src: string): Promise<TextureSource> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as unknown as { Image: new () => HTMLImageElement }).Image();
    img.onload = () => resolve(img as unknown as TextureSource);
    img.onerror = () => reject(new Error("intro texture failed to decode"));
    img.src = src;
  });
}

function onDisk(name: string, data: string): TextureSource {
  // Size in the name: a new build with new art never reuses an old file.
  const file = new File(Paths.cache, `mma-intro-${base64Bytes(data)}-${name}`);
  if (!file.exists || file.size !== base64Bytes(data)) file.write(data, { encoding: "base64" });
  return { localUri: file.uri };
}

export async function loadIntroTextures(): Promise<FireTextures> {
  if (Platform.OS === "web") {
    const [icon, nameMask, nameGlow] = await Promise.all(PARTS.map((p) => loadWebImage(`data:${p.mime};base64,${p.data}`)));
    return { icon, nameMask, nameGlow };
  }
  const [icon, nameMask, nameGlow] = PARTS.map((p) => onDisk(p.name, p.data));
  if (![icon, nameMask, nameGlow].every((t) => t.localUri?.startsWith("file://"))) {
    throw new Error(`intro textures not on disk: ${icon.localUri ?? "?"}`);
  }
  return { icon, nameMask, nameGlow };
}
