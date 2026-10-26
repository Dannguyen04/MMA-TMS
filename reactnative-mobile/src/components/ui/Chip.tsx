import { Pressable, View, type PressableProps } from "react-native";

import { PressScale, usePressState } from "./motion";
import { Text } from "./Text";
import { cx } from "./tokens";

export type ChipProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  selected?: boolean;
  /** Optional count shown after the label, rendered with tabular numerals. */
  count?: number;
  className?: string;
};

/** Selectable filter chip. Not a status indicator; use Badge for status. */
export function Chip({
  label,
  selected = false,
  count,
  disabled = false,
  className,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  ...rest
}: ChipProps) {
  const press = usePressState(onPressIn ?? undefined, onPressOut ?? undefined);

  return (
    <View className={cx("self-start", className)}>
      <PressScale pressed={press.pressed && !disabled}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ selected, disabled: !!disabled }}
          disabled={disabled}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          className={cx(
            "min-h-touch min-w-touch flex-row items-center justify-center gap-xs rounded-full border px-md",
            selected ? "bg-primary/15 border-primary" : "bg-surface border-border",
            disabled && "opacity-40",
          )}
          {...rest}
        >
          <Text variant="body" tone={selected ? "primary" : "default"} className="font-semibold" numberOfLines={1}>
            {label}
          </Text>
          {count !== undefined ? (
            <Text variant="caption" tone={selected ? "primary" : "muted"} numeric>
              {count}
            </Text>
          ) : null}
        </Pressable>
      </PressScale>
    </View>
  );
}
