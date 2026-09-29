import type { SplashVideoSource } from "./splash-video-types";

/**
 * Packed APK copy of assets/splash/videothanhcong.mp4 as res/raw/splash_loop.mp4.
 * Kept here so web modules share the same export names as native platforms.
 */
export const ANDROID_RAW_NAME = "splash_loop";
export const ANDROID_RESOURCE_URI = "android.resource://com.fogit.reactnativemobile/raw/splash_loop";
export const ANDROID_ASSET_URI = "asset:///splash/videothanhcong.mp4";

/**
 * Web: serve the real splash intro from `public/splash/videothanhcong.mp4`
 * (hardlinked to `assets/splash/…`). Avoids Metro `require()` of `.mp4`, which
 * previously failed the whole web bundle with UnableToResolveError even when
 * the file existed on disk (stale blockList / assetExts after APK-size tweaks).
 */
const WEB_SPLASH_URI = "/splash/videothanhcong.mp4";

export function loadBundledSplashVideo(): SplashVideoSource | null {
  try {
    return { uri: WEB_SPLASH_URI };
  } catch {
    return null;
  }
}
