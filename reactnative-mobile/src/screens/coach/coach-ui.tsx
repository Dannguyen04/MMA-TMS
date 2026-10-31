import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { coach } from "@/i18n/coach";
import { radius, spacing, type, useThemePreference } from "@/theme";

export function CoachScaffold({
  title,
  children,
  action,
  keyboard = false,
  inStack = false,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  keyboard?: boolean;
  inStack?: boolean;
}) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: (action ? spacing.lg : insets.bottom) + spacing.xxl },
      ]}
    >
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      {children}
    </ScrollView>
  );

  const column = (
    <View style={styles.flex}>
      {body}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: inStack ? spacing.md : insets.top + spacing.md,
          paddingHorizontal: spacing.screenX,
        },
      ]}
    >
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={inStack ? 64 : insets.top}
        >
          {column}
        </KeyboardAvoidingView>
      ) : (
        column
      )}
    </View>
  );
}

export function CoachBanner({ message, tone = "muted" }: { message: string; tone?: "muted" | "danger" | "ok" }) {
  const { colors } = useThemePreference();
  const color = tone === "danger" ? colors.danger : tone === "ok" ? colors.success : colors.inkMuted;
  return <Text style={[type.body, { color }]}>{message}</Text>;
}

export function CoachCard({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const { colors } = useThemePreference();
  const inner = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {inner}
    </Pressable>
  );
}

export function CoachField({
  label,
  helper,
  error,
  ...props
}: TextInputProps & { label: string; helper?: string; error?: string }) {
  const { colors } = useThemePreference();
  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: error ? colors.danger : colors.inkMuted, lineHeight: 18 }]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        style={[
          type.body,
          styles.input,
          {
            color: colors.ink,
            borderBottomColor: error ? colors.danger : colors.controlBorder,
          },
        ]}
        {...props}
      />
      {error ? (
        <Text style={[type.caption, { color: colors.danger, lineHeight: 16 }]}>{error}</Text>
      ) : helper ? (
        <Text style={[type.caption, { color: colors.inkSubtle, lineHeight: 16 }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

export function CoachPrimaryButton({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useThemePreference();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.cta,
        { backgroundColor: inactive ? colors.disabledFill : colors.cta },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={inactive ? colors.disabledInk : colors.onCta} />
      ) : (
        <Text style={[type.cta, { color: inactive ? colors.disabledInk : colors.onCta }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function CoachChip<T extends string>({
  value,
  selected,
  label,
  onPress,
}: {
  value: T;
  selected: boolean;
  label: string;
  onPress: (value: T) => void;
}) {
  const { colors } = useThemePreference();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.cta : colors.surfaceMuted,
          borderColor: selected ? colors.cta : colors.line,
        },
      ]}
    >
      <Text style={[type.caption, { color: selected ? colors.onCta : colors.ink, lineHeight: 16 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CoachPicker<T extends string>({
  label,
  valueLabel,
  placeholder,
  options,
  onSelect,
}: {
  label: string;
  valueLabel: string;
  placeholder: string;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: colors.inkMuted, lineHeight: 18 }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.picker, { borderBottomColor: colors.controlBorder }]}
      >
        <Text style={[type.body, { color: valueLabel ? colors.ink : colors.inkSubtle }]}>
          {valueLabel || placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.modal,
            { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom },
          ]}
        >
          <Text style={[type.title, { color: colors.ink }]}>{label}</Text>
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text style={[type.body, { color: colors.ink }]}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.option}>
            <Text style={[type.link, { color: colors.lotus }]}>{coach.close}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { gap: spacing.lg, flexGrow: 1 },
  action: { paddingVertical: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 44,
  },
  field: { gap: spacing.fieldLabelGap },
  input: {
    minHeight: 44,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  picker: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 1,
  },
  cta: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
  modal: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  option: {
    minHeight: 48,
    justifyContent: "center",
  },
});
