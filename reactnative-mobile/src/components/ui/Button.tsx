import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import { PressScale, usePressState } from "./motion";
import { Text, type TextTone } from "./Text";
import { cx, uiColors } from "./tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const containerClass: Record<ButtonVariant, string> = {
  primary: "bg-primary border-primary",
  secondary: "bg-surface-elevated border-border",
  ghost: "bg-transparent border-transparent",
  danger: "bg-danger border-danger",
};

/** Dark text on orange/red keeps WCAG AA contrast; light text on #F97316 does not. */
const labelTone: Record<ButtonVariant, TextTone> = {
  primary: "inverse",
  secondary: "default",
  ghost: "default",
  danger: "inverse",
};

const spinnerColor: Record<ButtonVariant, string> = {
  primary: uiColors.background,
  secondary: uiColors.text,
  ghost: uiColors.text,
  danger: uiColors.background,
};

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Optional leading icon node. */
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Layout-only classes for the outer wrapper (margin, flex, self-*). */
  className?: string;
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  className,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const inactive = !!disabled || loading;
  const press = usePressState(onPressIn ?? undefined, onPressOut ?? undefined);

  return (
    <View className={cx(fullWidth ? "w-full" : "self-start", className)}>
      <PressScale pressed={press.pressed && !inactive}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: inactive, busy: loading }}
          disabled={inactive}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          className={cx(
            "h-control min-w-touch flex-row items-center justify-center gap-sm rounded-control border px-lg",
            containerClass[variant],
            inactive && "opacity-40",
          )}
          {...rest}
        >
          {loading ? <ActivityIndicator size="small" color={spinnerColor[variant]} /> : icon}
          <Text variant="body" tone={labelTone[variant]} className="font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      </PressScale>
    </View>
  );
}
