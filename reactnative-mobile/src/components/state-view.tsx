import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FadeInView, PressableScale } from "@/components/motion";
import { StateIllustration, type StateKind } from "@/components/state-illustration";
import { radius, spacing, type, useThemePreference } from "@/theme";

/** Khối trạng thái chung: minh họa + tiêu đề + mô tả + hành động (tùy chọn). */
export function StateView({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  children,
}: {
  kind: StateKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useThemePreference();
  return (
    <FadeInView>
      <View
        accessible={!onAction}
        accessibilityRole={onAction ? undefined : "summary"}
        accessibilityLabel={onAction ? undefined : [title, description].filter(Boolean).join(". ")}
        style={[
          styles.box,
          compact && styles.compact,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <StateIllustration kind={kind} size={compact ? 72 : 96} />
        <Text style={[type.body, styles.title, { color: colors.ink }]}>{title}</Text>
        {description ? (
          <Text style={[type.caption, styles.body, { color: colors.inkMuted }]}>{description}</Text>
        ) : null}
        {children}
        {actionLabel && onAction ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={[styles.action, { borderColor: colors.lotus }]}
          >
            <Text style={[type.link, { color: colors.lotus }]}>{actionLabel}</Text>
          </PressableScale>
        ) : null}
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  compact: { paddingVertical: spacing.lg },
  title: { fontWeight: "600", textAlign: "center" },
  body: { textAlign: "center", lineHeight: 18 },
  action: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
});
