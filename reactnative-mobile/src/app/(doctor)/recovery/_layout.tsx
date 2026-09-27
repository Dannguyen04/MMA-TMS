import { Stack } from "expo-router";
import { useThemePreference } from "@/theme";

export default function RecoveryStack() {
  const { colors } = useThemePreference();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
