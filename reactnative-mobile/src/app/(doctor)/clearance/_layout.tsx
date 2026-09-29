import { Stack } from "expo-router";
import { useThemePreference } from "@/theme";

export default function ClearanceStack() {
  const { colors } = useThemePreference();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
