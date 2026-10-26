import "../../global.css";
import "react-native-reanimated";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { colorScheme } from "nativewind";
import { Platform } from "react-native";

import { AppToastHost } from "@/components/toast/app-toast";
import { LaunchGate } from "@/components/launch/launch-gate";
import { useSplashLock } from "@/components/launch/splash-lock";
import { SystemChrome } from "@/components/system-chrome";
import { SessionProvider, useSession } from "@/session/session-context";
import {
  chromeLightIcons,
  splash,
  ThemePreferenceProvider,
  useAppearanceActions,
  useAppearanceReady,
  useThemePreference,
} from "@/theme";

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
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
            title: "",
            contentStyle: { backgroundColor: "#0A0A0C" },
          }}
        />
        <Stack.Screen name="(guest)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="auth/reset-password" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(fighter)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(coach)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(doctor)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="appearance" options={{ headerShown: false, title: "" }} />
      </Stack>
    </>
  );
}

/**
 * Only LaunchGate (and its splash video) calls `SplashScreen.hideAsync`, so
 * holding it back keeps the brand-black native splash up until the saved
 * appearance and its body font are loaded — no theme or font flash.
 */
function AppearanceOwnerBridge() {
  const { user } = useSession();
  const { bindAppearanceOwner } = useAppearanceActions();
  useEffect(() => {
    bindAppearanceOwner(user?.id ?? null);
  }, [bindAppearanceOwner, user?.id]);
  return null;
}

function RootNavigator() {
  const appearanceReady = useAppearanceReady();
  if (!appearanceReady) return null;
  return (
    <LaunchGate>
      <LockedStack />
    </LaunchGate>
  );
}

export default function RootLayout() {
  useEffect(() => {
    console.log("[splash] hideAsync rootLayout mount", false, "splashUntilPlaying", true);
  }, []);

  useEffect(() => {
    // Native colorScheme.set calls Appearance.setColorScheme, which ThemePreferenceProvider owns.
    if (Platform.OS === "web") colorScheme.set("dark");
  }, []);

  return (
    <ThemePreferenceProvider>
      <SessionProvider>
        <AppearanceOwnerBridge />
        <RootNavigator />
        <AppToastHost />
      </SessionProvider>
    </ThemePreferenceProvider>
  );
}
