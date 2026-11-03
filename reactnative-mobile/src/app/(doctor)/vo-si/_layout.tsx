import { Stack } from "expo-router";

import { useThemePreference } from "@/theme";

export default function DoctorFightersStack() {
  const { colors } = useThemePreference();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
