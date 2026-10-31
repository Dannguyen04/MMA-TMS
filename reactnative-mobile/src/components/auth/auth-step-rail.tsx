import { Pressable, StyleSheet, Text, View } from "react-native";

import { spacing, type, useThemePreference } from "@/theme";

type AuthStepRailProps = {
  step: 1 | 2;
  labels: [string, string];
  onSelect: (next: 1 | 2) => void;
  compact?: boolean;
  enabled?: [boolean, boolean];
};

const STEPS = [1, 2] as const;

export function AuthStepRail({
  step,
  labels,
  onSelect,
  compact = false,
  enabled = [true, true],
}: AuthStepRailProps) {
  const { colors } = useThemePreference();
  const live = `Bước ${step} / 2 — ${labels[step - 1]}`;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLiveRegion="polite"
      accessibilityLabel={live}
      style={styles.row}
      testID="auth-step-rail"
    >
      {STEPS.map((value) => {
        const active = value === step;
        const done = value < step;
        const futureLocked = value > step && !enabled[value - 1];
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: futureLocked }}
            accessibilityLabel={`${value}. ${labels[value - 1]}`}
            disabled={futureLocked}
            onPress={() => onSelect(value)}
            hitSlop={compact ? { top: 8, bottom: 8, left: 0, right: 0 } : undefined}
            style={[styles.item, compact ? styles.itemCompact : null]}
          >
            <View
              style={[
                styles.bar,
                {
                  backgroundColor: active || done ? colors.lotus : colors.line,
                  opacity: futureLocked ? 0.45 : 1,
                },
              ]}
            />
            {compact ? null : (
              <Text
                numberOfLines={1}
                style={[
                  type.caption,
                  {
                    color: active ? colors.ink : colors.inkMuted,
                    fontWeight: active ? "600" : "400",
                  },
                ]}
              >
                {labels[value - 1]}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  item: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    gap: spacing.xs,
    overflow: "visible",
  },
  itemCompact: {
    minHeight: 44,
    justifyContent: "center",
  },
  bar: {
    height: 3,
    width: "100%",
    borderRadius: 2,
  },
});
