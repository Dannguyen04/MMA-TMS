const { withProjectBuildGradle } = require('expo/config-plugins');

const applyLine = 'apply from: new File(rootDir, "../scripts/windows-cmake.gradle")';
const rootPlugin = 'apply plugin: "com.facebook.react.rootproject"';

module.exports = function withWindowsCmake(config) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(applyLine)) {
      if (!config.modResults.contents.includes(rootPlugin)) {
        throw new Error('Cannot locate the React Native root plugin in android/build.gradle');
      }
      // The root plugin can evaluate :app immediately; register its DSL hook first.
      config.modResults.contents = config.modResults.contents.replace(
        rootPlugin,
        `// Keep Windows native build paths within toolchain limits.\n${applyLine}\n\n${rootPlugin}`
      );
    }
    return config;
  });
};
