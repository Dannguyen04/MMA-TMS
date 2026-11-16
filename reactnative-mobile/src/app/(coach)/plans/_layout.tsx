import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

/** Coach Giáo án (redesign step 17): every page draws its own header (RolePage). */
export default function CoachPlansStack() {
  const { colors } = useThemePreference();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}/>;
}
