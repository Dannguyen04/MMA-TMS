import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { appearance } from "@/i18n/appearance";
import {
  contentTextStyle,
  titleTextStyle,
  useColors,
  useLayoutTokens,
  useTypography,
} from "@/theme";

const s = appearance.sample;

/**
 * Renders every customizable token from the nearest `ThemeScope` (the draft).
 * Never reads `useThemePreference`, so applied tokens cannot leak in.
 */
export function AppearancePreview() {
  const { colors } = useColors();
  const typography = useTypography();
  const { spacing, radius, minTouchTarget } = useLayoutTokens();
  const [switchOn, setSwitchOn] = useState(true);

  const title = titleTextStyle(typography);
  const body = contentTextStyle("body", typography);
  const label = contentTextStyle("label", typography);
  const caption = contentTextStyle("caption", typography);
  const cta = contentTextStyle("cta", typography);
  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  };

  return (
    <View style={{ backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md }}>
      <Text style={[title, { color: colors.ink }]}>{s.heading}</Text>
      <Text style={[body, { color: colors.ink }]}>{s.body}</Text>
      <Text style={[caption, { color: colors.inkSubtle }]}>{s.caption}</Text>

      <View
        style={[
          styles.listItem,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderRadius: radius.field,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.md,
            minHeight: minTouchTarget + spacing.sm,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.line }]}>
          <Text style={[label, { color: colors.ink }]}>NĐ</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[body, { color: colors.ink }]} numberOfLines={1}>
            {s.listTitle}
          </Text>
          <Text style={[caption, { color: colors.inkMuted }]} numberOfLines={1}>
            {s.listSubtitle}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.inkMuted} />
      </View>

      <View style={[styles.bordered, card]}>
        <Text style={[label, { color: colors.lotus }]}>{s.cardTitle}</Text>
        <Text style={[title, { color: colors.ink }]}>{s.cardStat}</Text>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={[styles.chip, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <Text style={[caption, { color: colors.success }]}>{s.chipOk}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
            <Text style={[caption, { color: colors.danger }]}>{s.chipBad}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.row, { gap: spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.cta, borderRadius: radius.field, minHeight: minTouchTarget + 8 }]}
        >
          <Text style={[cta, { color: colors.onCta }]}>{s.primary}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[
            styles.button,
            styles.bordered,
            { borderColor: colors.controlBorder, borderRadius: radius.field, minHeight: minTouchTarget + 8 },
          ]}
        >
          <Text style={[cta, { color: colors.lotus }]}>{s.secondary}</Text>
        </Pressable>
        <View
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          style={[styles.button, { backgroundColor: colors.disabledFill, borderRadius: radius.field, minHeight: minTouchTarget + 8 }]}
        >
          <Text style={[cta, { color: colors.disabledInk }]}>{s.disabled}</Text>
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={[label, { color: colors.ink }]}>{s.inputLabel}</Text>
        <TextInput
          accessibilityLabel={s.inputLabel}
          defaultValue={s.inputValue}
          style={[
            body,
            styles.input,
            {
              color: colors.ink,
              backgroundColor: colors.surface,
              borderColor: colors.ring,
              borderRadius: radius.field,
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget + 4,
            },
          ]}
        />
        <TextInput
          accessibilityLabel={s.inputPlaceholder}
          placeholder={s.inputPlaceholder}
          placeholderTextColor={colors.inkSubtle}
          style={[
            body,
            styles.input,
            {
              color: colors.ink,
              backgroundColor: colors.surface,
              borderColor: colors.danger,
              borderRadius: radius.field,
              paddingHorizontal: spacing.md,
              minHeight: minTouchTarget + 4,
            },
          ]}
        />
        <Text style={[caption, { color: colors.danger }]}>{s.inputError}</Text>
      </View>

      <View style={[styles.row, styles.between, { minHeight: minTouchTarget }]}>
        <Text style={[body, { color: colors.ink }]}>{s.switchLabel}</Text>
        <Switch
          accessibilityLabel={s.switchLabel}
          value={switchOn}
          onValueChange={setSwitchOn}
          trackColor={{ false: colors.surfaceMuted, true: colors.cta }}
          thumbColor={switchOn ? colors.onCta : colors.surface}
          ios_backgroundColor={colors.surfaceMuted}
        />
      </View>

      <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.panel, padding: spacing.md }}>
        <View accessibilityRole="alert" style={[styles.bordered, card]}>
          <Text style={[title, { color: colors.ink }]}>{s.dialogTitle}</Text>
          <Text style={[body, { color: colors.inkMuted }]}>{s.dialogBody}</Text>
          <View style={[styles.row, styles.end, { gap: spacing.md }]}>
            <Text style={[cta, { color: colors.inkMuted }]}>{appearance.cancel}</Text>
            <Text style={[cta, { color: colors.lotus }]}>{s.dialogOk}</Text>
          </View>
        </View>
      </View>

      <View
        accessibilityRole="tablist"
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.field },
        ]}
      >
        {s.tabs.map((tab, index) => {
          const active = index === 0;
          const color = active ? colors.lotus : colors.inkMuted;
          return (
            <View
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, { minHeight: minTouchTarget + 8 }]}
            >
              <MaterialCommunityIcons
                name={index === 0 ? "home-variant" : index === 1 ? "calendar" : "account"}
                size={20}
                color={color}
              />
              <Text style={[caption, { color }]}>{tab}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  between: { justifyContent: "space-between" },
  end: { justifyContent: "flex-end" },
  bordered: { borderWidth: 1 },
  listItem: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  button: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  input: { borderWidth: 1 },
  tabBar: { flexDirection: "row", borderWidth: 1 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
});
