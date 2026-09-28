import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

export default function TapStack() {
  const { colors } = useThemePreference();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "fade",
        animationDuration: 160,
      }}
    />
  );
}
