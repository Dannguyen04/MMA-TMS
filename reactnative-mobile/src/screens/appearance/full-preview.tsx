import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appearance } from "@/i18n/appearance";
import { isFamilyLoaded } from "@/theme/appearance/fonts";
import type { AppearanceSettings, AppliedAppearance } from "@/theme/appearance/settings";
import { buildColors, buildLayout, buildTypography, toSemantic } from "@/theme/appearance/tokens";
import {
  radius,
  spacing,
  ThemeScope,
  type,
  useAppearanceState,
  useThemePreference,
  type ColorsValue,
} from "@/theme";

import { AppearancePreview } from "./appearance-preview";
import { appearanceExtra } from "./appearance-strings";

export type FullPreviewProps = {
  draft: AppliedAppearance;
  canApply: boolean;
  /** Same apply path as the editor (including the severe-contrast confirmation). */
  onApply: () => void;
  /** Keeps the draft. */
  onBackToEdit: () => void;
  /** Discards the draft and leaves Appearance. */
  onCancel: () => void;
};

/**
 * Draft tokens render only inside the `ThemeScope`; header, toggle and footer
 * stay on applied tokens. The light/dark toggle never touches `draft`.
 */
export function FullPreview({ draft, canApply, onApply, onBackToEdit, onCancel }: FullPreviewProps) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { systemScheme, osFontScale } = useAppearanceState();

  const draftDark = useMemo(
    () => buildColors(draft.settings, systemScheme).scheme === "dark",
    [draft.settings, systemScheme],
  );
  const [previewDark, setPreviewDark] = useState(draftDark);

  const previewSettings = useMemo<AppearanceSettings>(() => {
    if (previewDark === draftDark) return draft.settings;
    // Tối follows "Kiểu tối" (systemDarkVariant), so the preview keeps the chosen dark style.
    const mode = previewDark ? "dark" : "light";
    return { ...draft.settings, mode };
  }, [draft.settings, draftDark, previewDark]);

  const built = useMemo(() => buildColors(previewSettings, systemScheme), [previewSettings, systemScheme]);
  const previewColors = useMemo<ColorsValue>(
    () => ({ scheme: built.scheme, variant: built.variant, colors: built.colors, semantic: toSemantic(built.colors) }),
    [built],
  );
  const familyAvailable = isFamilyLoaded(draft.settings.fontFamily);
  const previewTypography = useMemo(
    () => buildTypography(draft.settings, osFontScale, familyAvailable),
    [draft.settings, osFontScale, familyAvailable],
  );
  const previewLayout = useMemo(() => buildLayout(draft.settings), [draft.settings]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.line, backgroundColor: colors.surface },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={appearanceExtra.backToEdit}
          hitSlop={8}
          onPress={onBackToEdit}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} />
        </Pressable>
        <Text style={[type.title, styles.headerTitle, { color: colors.ink }]}>{appearanceExtra.fullPreviewTitle}</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={[styles.toggleRow, { borderBottomColor: colors.line, backgroundColor: colors.surface }]}>
        <View style={styles.flex}>
          <Text style={[type.label, { color: colors.ink }]}>{appearanceExtra.previewDark}</Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>{appearanceExtra.previewDarkHint}</Text>
        </View>
        <Switch
          accessibilityLabel={appearanceExtra.previewDark}
          accessibilityHint={appearanceExtra.previewDarkHint}
          value={previewDark}
          onValueChange={setPreviewDark}
          trackColor={{ false: colors.surfaceMuted, true: colors.cta }}
          thumbColor={previewDark ? colors.onCta : colors.surface}
          ios_backgroundColor={colors.surfaceMuted}
          style={styles.switch}
        />
      </View>

      <ScrollView style={[styles.flex, { backgroundColor: built.colors.bg }]}>
        <ThemeScope colors={previewColors} typography={previewTypography} layout={previewLayout}>
          <AppearancePreview />
        </ThemeScope>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.line, backgroundColor: colors.surface },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={appearance.cancel}
          onPress={onCancel}
          style={[styles.footerButton, styles.bordered, { borderColor: colors.controlBorder }]}
        >
          <Text style={[type.cta, { color: colors.ink }]}>{appearance.cancel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={appearanceExtra.backToEdit}
          onPress={onBackToEdit}
          style={[styles.footerButton, styles.bordered, { borderColor: colors.controlBorder }]}
        >
          <Text style={[type.cta, { color: colors.ink }]}>{appearanceExtra.backToEdit}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={appearance.apply}
          accessibilityState={{ disabled: !canApply }}
          disabled={!canApply}
          onPress={onApply}
          style={[styles.footerButton, { backgroundColor: canApply ? colors.cta : colors.disabledFill }]}
        >
          <Text style={[type.cta, { color: canApply ? colors.onCta : colors.disabledInk }]}>{appearance.apply}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: "center" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toggleRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switch: { minWidth: 44, minHeight: 44 },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  footerButton: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.field,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  bordered: { borderWidth: 1 },
});
