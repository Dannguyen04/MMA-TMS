import { Stack } from "expo-router";

import { coach } from "@/i18n/coach";
import { blocked } from "@/i18n/blocked";
import { useThemePreference } from "@/theme";

export default function CoachFighterIdStack() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: coach.fighterDetail }} />
      <Stack.Screen name="videos" options={{ title: blocked.videos }} />
      <Stack.Screen name="goals" options={{ title: blocked.goalsNav }} />
      <Stack.Screen name="performance" options={{ title: blocked.performanceNav }} />
      <Stack.Screen name="medical" options={{ title: coach.medicalTitle }} />
      <Stack.Screen name="medical-history" options={{ title: coach.medicalHistoryTitle }} />
    </Stack>
  );
}
