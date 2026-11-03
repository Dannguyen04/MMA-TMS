import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from "react-native";

import { useThemePreference } from "@/theme";
import { mixHex } from "@/theme/appearance/color-math";

/**
 * Icon dùng chung theo Figma: nét outline kiểu Lucide → Feather (@expo/vector-icons).
 * Tên ngữ nghĩa giúp thống nhất icon giữa các role; màu mặc định lấy từ token theme.
 */
export type FeatherName = ComponentProps<typeof Feather>["name"];
type McName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export const ICONS = {
  home: "home",
  training: "activity",
  plans: "clipboard",
  body: "heart",
  me: "user",
  fighters: "users",
  schedule: "calendar",
  assigned: "folder",
  notifications: "bell",
  video: "video",
  upload: "upload",
  history: "clock",
  goals: "target",
  performance: "trending-up",
  clearance: "shield",
  medicalRecord: "folder",
  injury: "activity",
  recovery: "life-buoy",
  exam: "file-text",
  aiAlert: "cpu",
  settings: "settings",
  appearance: "sun",
  logout: "log-out",
  search: "search",
  add: "plus",
  check: "check",
  success: "check-circle",
  warning: "alert-triangle",
  error: "alert-triangle",
  retry: "refresh-cw",
  offline: "wifi-off",
  empty: "inbox",
  chevron: "chevron-right",
  close: "x",
  lock: "lock",
  mail: "mail",
  edit: "edit-3",
  exercise: "book-open",
  admission: "user-check",
  back: "chevron-left",
  chevronDown: "chevron-down",
  roles: "shield",
  aiJobs: "git-merge",
  aiModels: "layers",
  audit: "list",
  sliders: "sliders",
  send: "send",
  xCircle: "x-circle",
  ban: "slash",
  userPlus: "user-plus",
  trash: "trash-2",
  info: "info",
  alertCircle: "alert-circle",
  circle: "circle",
  folderPlus: "folder-plus",
  folderCheck: "folder",
  clipboardCheck: "clipboard",
  film: "film",
  filter: "filter",
  star: "star",
  more: "more-horizontal",
} as const satisfies Record<string, FeatherName>;

/** Vài glyph Feather không có (hình người, võ thuật) → MaterialCommunityIcons outline. */
const MC_ICONS = {
  bodyFigure: "human",
  martialArts: "karate",
  dumbbell: "dumbbell",
  stethoscope: "stethoscope",
  palette: "palette-outline",
} as const satisfies Record<string, McName>;

export type IconName = keyof typeof ICONS | keyof typeof MC_ICONS;

export type IconTone = "ink" | "muted" | "accent" | "danger" | "success" | "onAccent";

export function useIconColor(tone: IconTone): string {
  const { colors } = useThemePreference();
  switch (tone) {
    case "muted":
      return colors.inkMuted;
    case "accent":
      return colors.lotus;
    case "danger":
      return colors.danger;
    case "success":
      return colors.success;
    case "onAccent":
      return colors.onCta;
    default:
      return colors.ink;
  }
}

export function Icon({
  name,
  size = 20,
  tone = "ink",
  color,
}: {
  name: IconName;
  size?: number;
  tone?: IconTone;
  /** Ghi đè màu (vd. màu từ tabBar). */
  color?: ColorValue;
}) {
  const toneColor = useIconColor(tone);
  const c = (color ?? toneColor) as string;
  if (name in MC_ICONS) {
    return <MaterialCommunityIcons name={MC_ICONS[name as keyof typeof MC_ICONS]} size={size} color={c} />;
  }
  return <Feather name={ICONS[name as keyof typeof ICONS]} size={size} color={c} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Icon trong ô tròn nền accentSoft (hàng điều hướng / empty state). */
export function IconBadge({
  name,
  size = 20,
  tone = "accent",
  style,
}: {
  name: IconName;
  size?: number;
  tone?: IconTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useThemePreference();
  const box = size * 2;
  return (
    <View
      style={[
        styles.badge,
        { width: box, height: box, backgroundColor: mixHex(colors.surface, colors.lotus, 0.12) },
        style,
      ]}
    >
      <Icon name={name} size={size} tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 9999, alignItems: "center", justifyContent: "center" },
});
