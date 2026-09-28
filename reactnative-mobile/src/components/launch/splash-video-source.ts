import type { SplashVideoSource } from "./splash-video-types";

/**
 * Packed APK copy of assets/splash/videothanhcong.mp4 as res/raw/splash_loop.mp4.
 * Scheme-less "splash_loop" lets expo-video resolve R.raw.splash_loop in release.
 * Kept here so web/iOS modules share the same export names as Android.
 */
export const ANDROID_RAW_NAME = "splash_loop";
export const ANDROID_RESOURCE_URI = "android.resource://com.fogit.reactnativemobile/raw/splash_loop";
export const ANDROID_ASSET_URI = "asset:///splash/videothanhcong.mp4";

/**
 * iOS (default): Metro-bundled splash intro via `require`.
 * Web uses `splash-video-source.web.ts` (public URI, no require).
 * Android uses `splash-video-source.android.ts` (raw name, no require).
 */
const BUNDLED_SPLASH_MP4: number | string = require("../../../assets/splash/videothanhcong.mp4");

export function loadBundledSplashVideo(): SplashVideoSource | null {
  try {
    if (typeof BUNDLED_SPLASH_MP4 === "number") {
      return { assetId: BUNDLED_SPLASH_MP4 };
    }
    if (typeof BUNDLED_SPLASH_MP4 === "string" && BUNDLED_SPLASH_MP4.length > 0) {
      return { uri: BUNDLED_SPLASH_MP4 };
    }
    return null;
  } catch {
    return null;
  }
}
