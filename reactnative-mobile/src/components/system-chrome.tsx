import { NavigationBar, setVisibilityAsync as setNavVisibilityAsync } from "expo-navigation-bar";
import { usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, StatusBar as RNStatusBar } from "react-native";

import { chromeLightIcons, useThemePreference } from "@/theme";
import { useSplashLock } from "@/components/launch/splash-lock";

export function SystemChrome() {
  const locked = useSplashLock();
  const pathname = usePathname();
  const { colors } = useThemePreference();
  const visionAuth =
    pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";
  /** Home under ice uses app bg (`#090A0C`), not splash `#000`. */
  const bg = colors.bg;
  const lightIcons = locked ? true : chromeLightIcons(colors.bg);
  const navBarStyle = lightIcons ? "dark" : "light";

  useEffect(() => {
    if (visionAuth) return;
    void SystemUI.setBackgroundColorAsync(bg);

    if (Platform.OS !== "android") return;

    if (locked) {
      console.log(
        "[splash] SystemChrome",
        "navHidden",
        true,
        "hidden true",
        "translucent unchanged",
        "WHEN splash lock (onAppCovered / under ice)",
        "bg",
        bg,
      );
      RNStatusBar.setHidden(true);
      RNStatusBar.setBarStyle("light-content", false);
      NavigationBar.setHidden(true);
      void setNavVisibilityAsync("hidden");
      return;
    }

    console.log(
      "[splash] SystemChrome apply",
      "navHidden",
      false,
      "hidden false",
      "translucent false",
      "WHEN after onFinish (splash unlocked)",
      "bg",
      bg,
    );
    RNStatusBar.setHidden(false);
    RNStatusBar.setTranslucent(false);
    RNStatusBar.setBackgroundColor(bg, false);
    RNStatusBar.setBarStyle(lightIcons ? "light-content" : "dark-content", false);
    NavigationBar.setHidden(false);
    void setNavVisibilityAsync("visible");
    NavigationBar.setStyle(navBarStyle);
  }, [bg, lightIcons, locked, navBarStyle, visionAuth]);

  return (
    <>
      <StatusBar style={visionAuth || lightIcons ? "light" : "dark"} hidden={locked} />
      {Platform.OS === "android" ? (
        <NavigationBar style={visionAuth ? "dark" : navBarStyle} hidden={locked} />
      ) : null}
    </>
  );
}
