import { View, type ViewProps } from "react-native";

import { cx } from "./tokens";

export type CardProps = ViewProps & {
  /** Uses surface-elevated for content stacked on another surface. */
  elevated?: boolean;
  /** Layout-only classes (margin, flex, width). */
  className?: string;
};

export function Card({ elevated = false, className, ...rest }: CardProps) {
  return (
    <View
      className={cx(
        "rounded-card border border-border p-card",
        elevated ? "bg-surface-elevated" : "bg-surface",
        className,
      )}
      {...rest}
    />
  );
}
