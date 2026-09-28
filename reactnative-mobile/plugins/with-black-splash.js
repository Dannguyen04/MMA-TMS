const fs = require("fs");
const path = require("path");
const { withAndroidStyles, withDangerousMod } = require("expo/config-plugins");

const EMPTY_SPLASH = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#00000000" />
  <size android:width="1dp" android:height="1dp" />
</shape>
`;

const LAYER = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
</layer-list>
`;

function setItem(style, name, value) {
  style.item = style.item || [];
  const existing = style.item.find((entry) => entry.$?.name === name);
  if (existing) {
    existing._ = value;
    return;
  }
  style.item.push({ $: { name }, _: value });
}

function removeItem(style, name) {
  style.item = (style.item || []).filter((entry) => entry.$?.name !== name);
}

function applyBlackSplashTheme(stylesXml) {
  const styles = stylesXml.resources.style || [];
  const appTheme = styles.find((entry) => entry.$?.name === "AppTheme");
  if (appTheme) {
    setItem(appTheme, "android:windowBackground", "@android:color/transparent");
  }
  let splash = styles.find((entry) => entry.$?.name === "Theme.App.SplashScreen");
  if (!splash) {
    splash = { $: { name: "Theme.App.SplashScreen", parent: "AppTheme" }, item: [] };
    styles.push(splash);
  }

  setItem(splash, "android:windowBackground", "@android:color/transparent");
  setItem(splash, "android:windowSplashScreenBackground", "@android:color/transparent");
  setItem(splash, "android:windowSplashScreenAnimatedIcon", "@drawable/splash_empty");
  setItem(splash, "android:windowSplashScreenIconBackgroundColor", "@android:color/transparent");
  setItem(splash, "windowSplashScreenBackground", "@android:color/transparent");
  setItem(splash, "windowSplashScreenAnimatedIcon", "@drawable/splash_empty");
  setItem(splash, "windowSplashScreenIconBackgroundColor", "@android:color/transparent");
  setItem(splash, "postSplashScreenTheme", "@style/AppTheme");
  removeItem(splash, "android:windowSplashScreenBehavior");
  stylesXml.resources.style = styles;
  return stylesXml;
}

function removeSplashBitmaps(resDir) {
  // Splash window only. Never touch mipmap-*/ic_launcher* (home-screen icons).
  const files = [
    path.join(resDir, "drawable", "splashscreen_logo.xml"),
    path.join(resDir, "drawable-night", "splashscreen_logo.xml"),
  ];
  for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
    files.push(path.join(resDir, `drawable-${density}`, "splashscreen_logo.png"));
    files.push(path.join(resDir, `drawable-night-${density}`, "splashscreen_logo.png"));
  }
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

module.exports = function withBlackSplash(config) {
  config = withAndroidStyles(config, (next) => {
    next.modResults = applyBlackSplashTheme(next.modResults);
    return next;
  });

  config = withDangerousMod(config, [
    "android",
    async (next) => {
      const resDir = path.join(next.modRequest.projectRoot, "android/app/src/main/res");
      const drawable = path.join(resDir, "drawable");
      fs.mkdirSync(drawable, { recursive: true });
      fs.writeFileSync(path.join(drawable, "splash_empty.xml"), EMPTY_SPLASH);
      fs.writeFileSync(path.join(drawable, "ic_splash_layer.xml"), LAYER);
      removeSplashBitmaps(resDir);
      return next;
    },
  ]);

  return config;
};
