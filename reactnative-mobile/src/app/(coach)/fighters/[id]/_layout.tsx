import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

/** Sub-pages of one fighter (redesign step 16); each draws its own header. `index` and `medical` only redirect. */
export default function CoachFighterIdStack() {
  const { colors } = useThemePreference();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}/>;
}
