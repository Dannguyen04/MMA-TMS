import type { ReactNode } from "react";
import { View, type GestureResponderEvent } from "react-native";

import { Button, type ButtonVariant } from "./Button";
import { Text } from "./Text";
import { cx } from "./tokens";

export type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onPress: (e: GestureResponderEvent) => void;
    variant?: ButtonVariant;
  };
  className?: string;
};

export function EmptyState({ title, body, icon, action, className }: EmptyStateProps) {
  return (
    <View
      className={cx(
        "items-center gap-sm rounded-card border border-border bg-surface px-lg py-xl",
        className,
      )}
    >
      {icon}
      <Text variant="subtitle" className="text-center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" className="text-center">
          {body}
        </Text>
      ) : null}
      {action ? (
        <View className="mt-sm">
          <Button label={action.label} variant={action.variant ?? "secondary"} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
