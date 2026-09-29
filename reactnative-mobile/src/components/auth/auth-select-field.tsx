import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthUnderlineField } from "@/components/auth/auth-underline-field";
import { vi } from "@/i18n/vi";
import { radius, spacing, type, useThemePreference } from "@/theme";

type Option<T extends string> = {
  value: T;
  label: string;
};

type AuthSelectFieldProps<T extends string> = {
  label: string;
  value: T | "";
  placeholder: string;
  options: readonly Option<T>[];
  error?: string;
  helper?: string;
  clearable?: boolean;
  clearLabel?: string;
  onChange: (value: T | "") => void;
};

export function AuthSelectField<T extends string>({
  label,
  value,
  placeholder,
  options,
  error,
  helper,
  clearable,
  clearLabel,
  onChange,
}: AuthSelectFieldProps<T>) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.root}>
      <AuthUnderlineField
        label={label}
        error={error}
        helper={helper}
        helperPersistent
        focused={open}
        filled={Boolean(selected)}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        accessibilityLabel={selected ? `${label}. ${selected.label}` : `${label}. ${placeholder}`}
        accessory={<MaterialCommunityIcons name="chevron-down" size={22} color={colors.inkMuted} />}
      >
        <Text
          style={[
            type.body,
            styles.value,
            { color: selected ? colors.ink : colors.inkSubtle },
          ]}
        >
          {selected ? selected.label : open ? placeholder : ""}
        </Text>
      </AuthUnderlineField>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
            onPress={() => undefined}
          >
            <Text style={[type.title, { color: colors.ink, fontSize: 22 }]}>{label}</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.optionList}
              contentContainerStyle={styles.optionContent}
            >
              {clearable ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    !value ? { backgroundColor: colors.surfaceMuted } : null,
                  ]}
                >
                  <Text style={[type.body, { color: colors.inkMuted }]}>
                    {clearLabel ?? placeholder}
                  </Text>
                </Pressable>
              ) : null}
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={[
                      styles.option,
                      active ? { backgroundColor: colors.surfaceMuted } : null,
                    ]}
                  >
                    <Text style={[type.body, { color: colors.ink }]}>{option.label}</Text>
                    {active ? (
                      <MaterialCommunityIcons name="check" size={20} color={colors.lotus} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
              <Text style={[type.link, { color: colors.lotus }]}>{vi.common.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minWidth: 0,
  },
  value: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "72%",
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  optionList: {
    flexGrow: 0,
  },
  optionContent: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  option: {
    minHeight: 48,
    borderRadius: radius.field,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
