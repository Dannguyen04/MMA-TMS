import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cx, tabularNums } from "./tokens";

export type TextVariant = "label" | "caption" | "body" | "subtitle" | "title" | "display";
export type TextTone = "default" | "muted" | "primary" | "success" | "warning" | "danger" | "info" | "inverse";

const variantClass: Record<TextVariant, string> = {
  label: "text-label uppercase tracking-wider",
  caption: "text-caption",
  body: "text-body",
  subtitle: "text-subtitle font-semibold",
  title: "text-title font-bold",
  display: "text-display font-bold",
};

const toneClass: Record<TextTone, string> = {
  default: "text-text",
  muted: "text-muted",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  inverse: "text-background",
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  /** Defaults to `muted` for `label`, `default` otherwise. */
  tone?: TextTone;
  /** Tabular numerals so digits align in columns and don't jitter while updating. */
  numeric?: boolean;
  className?: string;
};

export function Text({ variant = "body", tone, numeric = false, className, style, ...rest }: TextProps) {
  const resolvedTone = tone ?? (variant === "label" ? "muted" : "default");
  return (
    <RNText
      className={cx(variantClass[variant], toneClass[resolvedTone], className)}
      style={numeric ? [tabularNums, style] : style}
      {...rest}
    />
  );
}
