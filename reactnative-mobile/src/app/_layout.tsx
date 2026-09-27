import "react-native-reanimated";
import { useEffect } from "react";
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
} from "@expo-google-fonts/barlow-condensed";
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { LaunchGate } from "@/components/launch/launch-gate";
import { useSplashLock } from "@/components/launch/splash-lock";
import { SystemChrome } from "@/components/system-chrome";
import { SessionProvider } from "@/session/session-context";
import { chromeLightIcons, splash, ThemePreferenceProvider, useThemePreference } from "@/theme";

void SplashScreen.preventAutoHideAsync();

function LockedStack() {
  const locked = useSplashLock();
  const { colors } = useThemePreference();
  /**
   * This Stack only mounts under ice (or after live). Never paint `splash.canvas`
   * `#000` here — shard holes would read black. Ice + sheet already cover the fighter.
   */
  const bg = colors.bg;
  const barStyle = locked ? "light" : chromeLightIcons(colors.bg) ? "light" : "dark";

  useEffect(() => {
    console.log(
      "[splash] LockedStack mount",
      "contentStyle",
      bg,
      "statusBarHidden",
      locked,
      "navigationBarHidden",
      locked,
      "navHidden",
      locked,
      "WHEN",
      locked ? "under ice (onAppCovered) — chrome hidden/translucent unchanged" : "live",
    );
  }, [bg, locked]);

  return (
    <>
      <SystemChrome />
      <Stack
        screenOptions={{
          headerShown: false,
          title: "",
          headerTitle: "",
          headerStyle: { backgroundColor: bg },
          headerTintColor: locked ? splash.text : colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: bg },
          statusBarStyle: barStyle,
          statusBarBackgroundColor: bg,
          statusBarHidden: locked,
          navigationBarHidden: locked,
          navigationBarColor: bg,
          animation: "none",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(guest)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="auth/reset-password" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(fighter)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(coach)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(doctor)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false, title: "" }} />
      </Stack>
    </>
  );
}

function RootNavigator() {
  return (
    <LaunchGate>
      <LockedStack />
    </LaunchGate>
  );
}

export default function RootLayout() {
  useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_900Black,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  useEffect(() => {
    console.log("[splash] hideAsync rootLayout mount", false, "splashUntilPlaying", true);
  }, []);

  return (
    <ThemePreferenceProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemePreferenceProvider>
  );
}
