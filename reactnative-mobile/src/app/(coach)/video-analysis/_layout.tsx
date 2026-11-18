import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

/** Coach Video stack: every page draws its own 54px header (redesign step 19). */
export default function VideoAnalysisStack() {
  const { colors } = useThemePreference();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
