const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// moti re-exports SafeAreaView from react-native. RN 0.86 warns as soon as that
// getter is touched, and `import { MotiView } from "moti"` loads the barrel.
// The app never renders MotiSafeAreaView, so swap that one module for the
// supported library component. Set this before withNativeWind so css-interop
// keeps calling it.
const motiSafeAreaShim = path.resolve(__dirname, "src/shims/moti-safe-area-view.ts");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = (context.originModulePath || "").replace(/\\/g, "/");
  const specifier = moduleName.replace(/\\/g, "/");
  const fromMotiComponents =
    /\/moti\/(?:src|build)\/components\/index\.(?:ts|tsx|js)$/.test(origin);
  const isSafeAreaModule =
    specifier === "./safe-area-view" ||
    /\/moti\/(?:src|build)\/components\/safe-area-view(?:\.(?:tsx|ts|js))?$/.test(specifier);
  if (fromMotiComponents && isSafeAreaModule) {
    return { type: "sourceFile", filePath: motiSafeAreaShim };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Explicitly keep mp4 as an asset (iOS still `require`s the splash intro).
// Do not strip mp4 from assetExts — that made Metro report the file as missing
// and broke the web/iOS bundle with UnableToResolveError.
if (!config.resolver.assetExts.includes("mp4")) {
  config.resolver.assetExts.push("mp4");
}

// Only block the APK-packed android/**/*.mp4 copies from the JS graph.
// Never block assets/splash/*.mp4.
const androidMp4Block = /(?:^|[\\/])android[\\/].*\.mp4$/;
const existingBlock = config.resolver.blockList;
config.resolver.blockList = existingBlock
  ? [existingBlock, androidMp4Block].flat()
  : androidMp4Block;

module.exports = withNativeWind(config, { input: "./global.css" });
