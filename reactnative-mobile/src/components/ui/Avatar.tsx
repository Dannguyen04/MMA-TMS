import { Image, Pressable, View, type GestureResponderEvent } from "react-native";

import { PressScale, usePressState } from "./motion";
import { Text, type TextVariant } from "./Text";
import { cx } from "./tokens";

export type AvatarSize = "sm" | "md" | "lg";

const sizeClass: Record<AvatarSize, string> = {
  sm: "h-avatar-sm w-avatar-sm",
  md: "h-avatar-md w-avatar-md",
  lg: "h-avatar-lg w-avatar-lg",
};

const initialsVariant: Record<AvatarSize, TextVariant> = {
  sm: "caption",
  md: "body",
  lg: "subtitle",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export type AvatarProps = {
  name: string;
  uri?: string;
  size?: AvatarSize;
  onPress?: (e: GestureResponderEvent) => void;
  className?: string;
};

export function Avatar({ name, uri, size = "md", onPress, className }: AvatarProps) {
  const press = usePressState();

  const face = (
    <View
      className={cx(
        "items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated",
        sizeClass[size],
      )}
    >
      {uri ? (
        <Image source={{ uri }} className="h-full w-full" accessibilityIgnoresInvertColors />
      ) : (
        <Text variant={initialsVariant[size]} className="font-semibold">
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View accessibilityRole="image" accessibilityLabel={name} className={cx("self-start", className)}>
        {face}
      </View>
    );
  }

  return (
    <View className={cx("self-start", className)}>
      <PressScale pressed={press.pressed}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          className="min-h-touch min-w-touch items-center justify-center rounded-full"
        >
          {face}
        </Pressable>
      </PressScale>
    </View>
  );
}
