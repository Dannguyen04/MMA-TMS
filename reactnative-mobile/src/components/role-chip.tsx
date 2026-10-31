import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { doctorRo } from "@/i18n/doctor-ro";
import { useThemePreference } from "@/theme";

type Role = keyof typeof doctorRo.roles;

const ICON: Record<Role, ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  DOCTOR: "stethoscope",
  COACH: "whistle-outline",
  ADMIN: "shield-account-outline",
  FIGHTER: "boxing-glove",
  GUEST: "account-outline",
};

/**
 * Chip vai trò trên đầu hồ sơ (chung mọi role): nền surfaceMuted, chữ ink 13 medium, icon 14dp, cao 28dp.
 * Không dùng xanh lá (dành cho trạng thái "Khỏe").
 */
export function RoleChip({ role, label: override }: { role: Role; /** Nhãn riêng (vd. "HLV trưởng"). */ label?: string }) {
  const { colors } = useThemePreference();
  const label = override ?? doctorRo.roles[role];
  return (
    <View accessible accessibilityLabel={label} style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
      <MaterialCommunityIcons name={ICON[role]} size={14} color={colors.ink} />
      <Text style={[styles.text, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 6, height: 28, borderRadius: 14, paddingHorizontal: 12 },
  text: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
});
