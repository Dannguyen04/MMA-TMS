import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

export default function VideoAnalysisStack() {
  const { colors } = useThemePreference();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
