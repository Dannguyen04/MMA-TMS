import { Stack } from "expo-router";

import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";

export default function FighterGroupLayout() {
  const { colors } = useThemePreference();

  return (
    <RoleLayoutGate allow="fighter">
      <Stack
        screenOptions={{
          headerShown: false,
          title: "",
          contentStyle: { backgroundColor: colors.bg },
          animation: "fade",
          animationDuration: 160,
        }}
      />
    </RoleLayoutGate>
  );
}
