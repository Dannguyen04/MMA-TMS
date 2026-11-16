import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

/** Every Lịch page draws its own header (redesign step 18). */
export default function CoachScheduleStack() {
  const { colors } = useThemePreference();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
