import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";

import { Text } from "./Text";
import { cx, uiColors } from "./tokens";

export type ListRowProps = {
  title: string;
  /** Trailing value, rendered with tabular numerals when it is a number. */
  value?: string | number;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Defaults to true when onPress is set. */
  showChevron?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  className?: string;
};

/** 48pt row. Full-width rows use a background highlight instead of scale for press feedback. */
export function ListRow({
  title,
  value,
  leading,
  trailing,
  showChevron,
  onPress,
  disabled = false,
  className,
}: ListRowProps) {
  const chevron = showChevron ?? !!onPress;
  const content = (
    <>
      {leading}
      <Text variant="body" className="flex-1" numberOfLines={1}>
        {title}
      </Text>
      {value !== undefined ? (
        <Text variant="body" tone="muted" numeric={typeof value === "number"} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={uiColors.muted} /> : null}
    </>
  );
  const base = "h-row flex-row items-center gap-md px-md";

  if (!onPress) {
    return <View className={cx(base, className)}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${title}, ${value}` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        base,
        "min-h-touch",
        disabled ? "opacity-40" : "active:bg-surface-elevated",
        className,
      )}
    >
      {content}
    </Pressable>
  );
}
