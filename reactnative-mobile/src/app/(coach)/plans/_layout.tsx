import { Stack } from "expo-router";

import { coach } from "@/i18n/coach";
import { useThemePreference } from "@/theme";

export default function CoachPlansStack() {
  const { colors } = useThemePreference();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: coach.tabs.plans }} />
      <Stack.Screen name="new" options={{ title: coach.newPlan }} />
      <Stack.Screen name="chi-tiet" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: coach.planDetail }} />
    </Stack>
  );
}
