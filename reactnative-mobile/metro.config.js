const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

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

module.exports = config;
