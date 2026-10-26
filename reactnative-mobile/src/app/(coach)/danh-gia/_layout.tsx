import { Stack } from "expo-router";

import { vi } from "@/i18n/vi";
import { useThemePreference } from "@/theme";

export default function CoachAdmissionsStack() {
  const { colors } = useThemePreference();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: vi.admission.assigned }} />
      <Stack.Screen name="[id]" options={{ title: vi.admission.title }} />
    </Stack>
  );
}
