import { View } from "react-native";

import { Text, type TextTone } from "./Text";
import { cx, type StatusTone } from "./tokens";

/** Status only. Never primary: orange is reserved for actions and key highlights. */
export type BadgeVariant = StatusTone | "neutral";

const containerClass: Record<BadgeVariant, string> = {
  success: "bg-success/15 border-success/40",
  warning: "bg-warning/15 border-warning/40",
  danger: "bg-danger/15 border-danger/40",
  info: "bg-info/15 border-info/40",
  neutral: "bg-surface-elevated border-border",
};

const toneFor: Record<BadgeVariant, TextTone> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "muted",
};

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ label, variant = "neutral", className }: BadgeProps) {
  return (
    <View
      accessibilityRole="text"
      className={cx("flex-row items-center self-start rounded-full border px-sm py-[2px]", containerClass[variant], className)}
    >
      <Text variant="caption" tone={toneFor[variant]} className="font-semibold" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
