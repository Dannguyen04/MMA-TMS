import { forwardRef, useId, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Text } from "./Text";
import { cx, uiColors } from "./tokens";

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  /** Replaces helper text and switches the field to the danger state. */
  error?: string;
  helper?: string;
  disabled?: boolean;
  /** Layout-only classes for the outer wrapper. */
  className?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, disabled = false, className, accessibilityLabel, onFocus, onBlur, ...rest },
  ref,
) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const message = error ?? helper;

  return (
    <View className={cx("w-full gap-xs", className)}>
      {label ? (
        <Text variant="caption" tone="muted" nativeID={`${id}-label`} className="font-semibold">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        editable={!disabled}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityLabelledBy={label ? `${id}-label` : undefined}
        accessibilityHint={error}
        accessibilityState={{ disabled }}
        placeholderTextColor={uiColors.muted}
        selectionColor={uiColors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cx(
          "h-control rounded-control border bg-surface px-md text-body text-text",
          error ? "border-danger" : focused ? "border-primary" : "border-border",
          disabled && "opacity-40",
        )}
        {...rest}
      />
      {message ? (
        <Text variant="caption" tone={error ? "danger" : "muted"}>
          {message}
        </Text>
      ) : null}
    </View>
  );
});
