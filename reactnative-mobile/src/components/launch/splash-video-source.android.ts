import type { SplashVideoSource } from "./splash-video-types";

/**
 * Packed APK copy of assets/splash/videothanhcong.mp4 as res/raw/splash_loop.mp4.
 * Scheme-less "splash_loop" lets expo-video resolve R.raw.splash_loop in release.
 */
export const ANDROID_RAW_NAME = "splash_loop";
export const ANDROID_RESOURCE_URI = "android.resource://com.fogit.reactnativemobile/raw/splash_loop";
export const ANDROID_ASSET_URI = "asset:///splash/videothanhcong.mp4";

export function loadBundledSplashVideo(): SplashVideoSource | null {
  try {
    // Scheme-less raw name is required: expo-video parseLocalAssetId only
    // looks up R.raw.* when uri.scheme == null. android.resource:// is
    // passed through unchanged and can fail to open on device.
    return { uri: ANDROID_RAW_NAME };
  } catch {
    return null;
  }
}
