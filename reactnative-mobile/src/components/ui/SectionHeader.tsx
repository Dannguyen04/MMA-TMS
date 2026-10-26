import { Pressable, View, type GestureResponderEvent } from "react-native";

import { Text } from "./Text";
import { cx } from "./tokens";

export type SectionHeaderProps = {
  title: string;
  action?: {
    label: string;
    onPress: (e: GestureResponderEvent) => void;
  };
  className?: string;
};

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <View className={cx("min-h-touch flex-row items-center justify-between gap-md", className)}>
      <Text variant="subtitle" accessibilityRole="header" className="flex-1" numberOfLines={1}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          className="min-h-touch min-w-touch items-center justify-center rounded-control px-sm active:opacity-70"
        >
          <Text variant="body" tone="primary" className="font-semibold">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
