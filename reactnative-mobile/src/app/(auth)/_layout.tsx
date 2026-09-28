import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StatusBar as RNStatusBar } from "react-native";

import { AuthSessionGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";

export default function AuthLayout() {
  const { colors, resolvedScheme } = useThemePreference();
  const barStyle = resolvedScheme === "dark" ? "light" : "dark";

  useEffect(() => {
    StatusBar.setStyle(barStyle, true);
    if (Platform.OS !== "android") return;
    RNStatusBar.setBarStyle(
      resolvedScheme === "dark" ? "light-content" : "dark-content",
      true,
    );
    RNStatusBar.setBackgroundColor(colors.bg, false);
  }, [barStyle, colors.bg, resolvedScheme]);

  return (
    <AuthSessionGate>
      <StatusBar style={barStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          title: "",
          headerTitle: "",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          animation: "fade",
          animationDuration: 200,
          contentStyle: { backgroundColor: colors.bg },
          statusBarStyle: barStyle,
          statusBarBackgroundColor: colors.bg,
          navigationBarColor: colors.bg,
        }}
      />
    </AuthSessionGate>
  );
}
