import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastMessage } from "@/components/toast/app-toast";
import { appearance } from "@/i18n/appearance";
import { ensureContrast } from "@/theme/appearance/color-math";
import { BODY_FONTS, isFamilyLoaded, loadFamily } from "@/theme/appearance/fonts";
import {
  appearanceEqual,
  shouldAnnounceApplySuccess,
  BRIGHTNESS_MODES,
  DARK_VARIANTS,
  DEFAULT_APPEARANCE,
  DENSITIES,
  FONT_FAMILY_IDS,
  FONT_WEIGHTS,
  NUMERIC_RANGES,
  PRESET_IDS,
  RADIUS_SCALES,
  resolvePreset,
  settingsEqual,
  type AppearanceSettings,
  type AppliedAppearance,
  type FontFamilyId,
  type PresetId,
} from "@/theme/appearance/settings";
import {
  buildColors,
  buildLayout,
  buildTypography,
  contrastReport,
  toSemantic,
  type ContrastCheck,
} from "@/theme/appearance/tokens";
import {
  radius,
  spacing,
  ThemeScope,
  type,
  useAppearanceActions,
  useAppearanceState,
  useThemePreference,
  type ColorsValue,
} from "@/theme";

import { AppearancePreview } from "./appearance-preview";
import { HexField, HsvPicker, Segmented, SwatchRow, TrackSlider } from "./controls";
import { FullPreview } from "./full-preview";

type ColorRole = "textColor" | "backgroundColor" | "surfaceColor" | "accentColor";
const COLOR_ROLES: readonly ColorRole[] = ["textColor", "backgroundColor", "surfaceColor", "accentColor"];

const SWATCHES: Record<ColorRole, readonly string[]> = {
  textColor: ["#121316", "#000000", "#3B2F20", "#13241A", "#F3F1EC", "#FFFFFF"],
  backgroundColor: ["#FFFFFF", "#E8E6E1", "#F4ECD8", "#E3EFE3", "#D9DBDF", "#090A0C", "#000000"],
  surfaceColor: ["#FFFFFF", "#F6F5F2", "#FBF6EA", "#F2F8F2", "#14161A", "#0E0F11"],
  accentColor: ["#735A30", "#C9A86C", "#1F5FBF", "#1F6B3A", "#B3261E", "#6A3FB5", "#B35200"],
};

const HISTORY_LIMIT = 50;
const UNDO_SNACKBAR_MS = 8000;

type SectionId = "theme" | "text" | "colors" | "layout";
const SECTION_KEYS: Record<SectionId, readonly (keyof AppearanceSettings)[]> = {
  theme: ["mode", "systemDarkVariant"],
  text: ["fontFamily", "fontScale", "fontWeight", "lineHeight", "letterSpacing"],
  colors: ["textColor", "backgroundColor", "surfaceColor", "accentColor"],
  layout: ["radiusScale", "density"],
};

function options<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

function formatRatio(n: number) {
  return (Math.floor(n * 100) / 100).toFixed(2);
}

export function AppearanceScreen() {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { applied, previousApplied, systemScheme, osFontScale, persistError } = useAppearanceState();
  const { applyAppearance, undoLastApply, registerFont } = useAppearanceActions();

  const [draft, setDraft] = useState<AppliedAppearance>(applied);
  const [editorTab, setEditorTab] = useState<"customize" | "preview">("customize");
  const [history, setHistory] = useState<AppliedAppearance[]>([]);
  const [colorRole, setColorRole] = useState<ColorRole>("textColor");
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [, setFontTick] = useState(0);
  const [pendingFont, setPendingFont] = useState<FontFamilyId | null>(null);
  const [fontNotice, setFontNotice] = useState<string | null>(null);
  useToastMessage(fontNotice, "error");
  useToastMessage(persistError ? appearance.saveFailed : "", "error");
  const [fullPreview, setFullPreview] = useState(false);
  /** Applied value before the last Apply; non-null while the Undo snackbar is visible. */
  const [undoSnack, setUndoSnack] = useState<{ before: AppliedAppearance; key: number } | null>(null);
  const undoSnackRef = useRef(undoSnack);
  undoSnackRef.current = undoSnack;

  const isDirty = !appearanceEqual(draft, applied);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const fullPreviewRef = useRef(fullPreview);
  fullPreviewRef.current = fullPreview;
  const allowLeaveRef = useRef(false);
  const mountedRef = useRef(true);
  const fontLoadTokenRef = useRef(0);
  const runApplyRef = useRef<(after?: () => void) => void>(() => undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!undoSnack) return;
    const timer = setTimeout(() => setUndoSnack(null), UNDO_SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [undoSnack]);

  useEffect(() => {
    const family = draft.settings.fontFamily;
    if (isFamilyLoaded(family)) return;
    let cancelled = false;
    void loadFamily(family).then(() => {
      if (!cancelled) setFontTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.settings.fontFamily]);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (allowLeaveRef.current) return;
        if (fullPreviewRef.current) {
          event.preventDefault();
          setFullPreview(false);
          return;
        }
        if (!dirtyRef.current) return;
        event.preventDefault();
        const proceed = () => {
          allowLeaveRef.current = true;
          navigation.dispatch(event.data.action);
        };
        Alert.alert(appearance.unsavedTitle, appearance.unsavedBody, [
          { text: appearance.discard.keep, style: "cancel" },
          { text: appearance.discard.discard, style: "destructive", onPress: proceed },
          { text: appearance.unsavedSave, onPress: () => runApplyRef.current(proceed) },
        ]);
      }),
    [navigation],
  );

  const draftBuilt = useMemo(() => buildColors(draft.settings, systemScheme), [draft.settings, systemScheme]);
  const draftColors = useMemo<ColorsValue>(
    () => ({
      scheme: draftBuilt.scheme,
      variant: draftBuilt.variant,
      colors: draftBuilt.colors,
      semantic: toSemantic(draftBuilt.colors),
    }),
    [draftBuilt],
  );
  const familyAvailable = isFamilyLoaded(draft.settings.fontFamily);
  const draftTypography = useMemo(
    () => buildTypography(draft.settings, osFontScale, familyAvailable),
    [draft.settings, osFontScale, familyAvailable],
  );
  const draftLayout = useMemo(() => buildLayout(draft.settings), [draft.settings]);
  const issues = useMemo(
    () => contrastReport(draftBuilt.colors, draftTypography).filter((check) => check.level !== "ok"),
    [draftBuilt.colors, draftTypography],
  );
  const hasSevere = issues.some((check) => check.level === "severe");

  const slidingRef = useRef(false);
  const gestureSavedRef = useRef(false);

  const pushHistory = () => {
    const snapshot = draftRef.current;
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), snapshot]);
  };

  /** One undo step per drag gesture, not per slider tick. */
  const update = (patch: Partial<AppearanceSettings>) => {
    if (!slidingRef.current || !gestureSavedRef.current) {
      pushHistory();
      if (slidingRef.current) gestureSavedRef.current = true;
    }
    setDraft((d) => ({ presetId: d.presetId, settings: { ...d.settings, ...patch } }));
  };

  const setRoleColor = (role: ColorRole, hex: string | null) => {
    const patch: Partial<AppearanceSettings> = {};
    patch[role] = hex;
    update(patch);
  };

  const onSlidingChange = (active: boolean) => {
    slidingRef.current = active;
    gestureSavedRef.current = false;
    setScrollEnabled(!active);
  };

  const cancelFontLoad = () => {
    fontLoadTokenRef.current += 1;
    setPendingFont(null);
  };

  /** A font id enters the draft only after its faces are registered; failures keep the previous font. */
  const whenFontReady = (id: FontFamilyId, onReady: (usable: boolean) => void) => {
    const token = ++fontLoadTokenRef.current;
    setFontNotice(null);
    if (isFamilyLoaded(id)) {
      setPendingFont(null);
      onReady(true);
      return;
    }
    setPendingFont(id);
    void registerFont(id).then((ok) => {
      if (!mountedRef.current || token !== fontLoadTokenRef.current) return;
      setPendingFont(null);
      const usable = ok && isFamilyLoaded(id);
      if (!usable) setFontNotice(appearance.fontUnavailable(BODY_FONTS[id].label));
      onReady(usable);
    });
  };

  const selectFont = (id: FontFamilyId) => {
    if (id === draftRef.current.settings.fontFamily) {
      cancelFontLoad();
      return;
    }
    whenFontReady(id, (usable) => {
      if (usable) update({ fontFamily: id });
    });
  };

  const pickPreset = (presetId: PresetId) => {
    const settings = resolvePreset(presetId);
    whenFontReady(settings.fontFamily, (usable) => {
      pushHistory();
      setDraft({
        presetId,
        settings: usable ? settings : { ...settings, fontFamily: draftRef.current.settings.fontFamily },
      });
    });
  };

  const canUndo = history.length > 0 || previousApplied !== null;
  const onUndo = () => {
    cancelFontLoad();
    if (history.length > 0) {
      setDraft(history[history.length - 1]);
      setHistory((h) => h.slice(0, -1));
      return;
    }
    if (previousApplied) {
      setUndoSnack(null);
      setDraft(previousApplied);
      void undoLastApply();
    }
  };

  const onSnackUndo = () => {
    const snack = undoSnackRef.current;
    if (!snack) return;
    undoSnackRef.current = null;
    setUndoSnack(null);
    cancelFontLoad();
    void undoLastApply();
    setDraft(snack.before);
  };

  const onReset = () => {
    Alert.alert(appearance.resetConfirmTitle, appearance.resetConfirmBody, [
      { text: appearance.cancel, style: "cancel" },
      {
        text: appearance.resetConfirm,
        style: "destructive",
        onPress: () => {
          whenFontReady(DEFAULT_APPEARANCE.settings.fontFamily, (usable) => {
            pushHistory();
            setDraft(
              usable
                ? DEFAULT_APPEARANCE
                : {
                    presetId: DEFAULT_APPEARANCE.presetId,
                    settings: { ...DEFAULT_APPEARANCE.settings, fontFamily: draftRef.current.settings.fontFamily },
                  },
            );
          });
        },
      },
    ]);
  };

  const onResetSection = (section: SectionId, title: string) => {
    Alert.alert(appearance.resetSectionTitle(title), appearance.resetSectionBody, [
      { text: appearance.cancel, style: "cancel" },
      {
        text: appearance.resetConfirm,
        style: "destructive",
        onPress: () => {
          const defaults = DEFAULT_APPEARANCE.settings;
          const patch: Partial<AppearanceSettings> = {};
          for (const key of SECTION_KEYS[section]) Object.assign(patch, { [key]: defaults[key] });
          if (section !== "text") {
            update(patch);
            return;
          }
          whenFontReady(defaults.fontFamily, (usable) => {
            if (!usable) delete patch.fontFamily;
            update(patch);
          });
        },
      },
    ]);
  };

  const leave = () => {
    allowLeaveRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const doApply = async () => {
    const before = applied;
    const saved = await applyAppearance(draftRef.current);
    if (!mountedRef.current || !shouldAnnounceApplySuccess(saved)) return;
    setUndoSnack({ before, key: Date.now() });
    setFullPreview(false);
  };

  const discardDraft = () => {
    cancelFontLoad();
    draftRef.current = applied;
    dirtyRef.current = false;
    setDraft(applied);
    setHistory([]);
    setFontNotice(null);
  };

  const onCancel = () => {
    discardDraft();
    leave();
  };

  const runApply = (after?: () => void) => {
    const confirmed = () => {
      doApply();
      after?.();
    };
    if (!hasSevere) {
      confirmed();
      return;
    }
    Alert.alert(appearance.contrast.severeTitle, appearance.contrast.severeBody, [
      { text: appearance.cancel, style: "cancel" },
      { text: appearance.contrast.severeConfirm, style: "destructive", onPress: confirmed },
    ]);
  };
  runApplyRef.current = runApply;

  const onApply = () => {
    if (!isDirty) return;
    runApply();
  };

  const fixIssue = (check: ContrastCheck) => {
    const c = draftBuilt.colors;
    switch (check.id) {
      case "textOnBackground":
      case "textOnSurface":
        update({ textColor: ensureContrast(c.ink, check.bg, check.required) });
        return;
      case "secondaryOnBackground":
      case "secondaryOnSurface":
      case "tertiaryOnBackground":
      case "tertiaryOnSurface":
        // Secondary tones derive from the text color; more headroom fixes them.
        update({ textColor: ensureContrast(c.ink, check.bg, 7) });
        return;
      case "linkOnBackground":
        update({ accentColor: ensureContrast(c.lotus, check.bg, check.required) });
        return;
      case "onAccent":
        // An explicit accent gets an auto black/white label, which always passes 4.5:1.
        update({ accentColor: c.cta });
    }
  };

  const presetLabel = settingsEqual(draft.settings, resolvePreset(draft.presetId))
    ? appearance.presets[draft.presetId]
    : `${appearance.customPreset} (${appearance.presets[draft.presetId]})`;

  const roleValue = draft.settings[colorRole];
  const roleEffective =
    colorRole === "textColor"
      ? draftBuilt.colors.ink
      : colorRole === "backgroundColor"
        ? draftBuilt.colors.bg
        : colorRole === "surfaceColor"
          ? draftBuilt.colors.surface
          : draftBuilt.colors.cta;

  if (fullPreview) {
    return (
      <FullPreview
        draft={draft}
        canApply={isDirty}
        onApply={onApply}
        onBackToEdit={() => setFullPreview(false)}
        onCancel={leave}
      />
    );
  }

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
          accessibilityLabel={appearance.back}
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[type.title, styles.headerTitle, { color: colors.ink, textTransform: "none" }]}
        >
          {appearance.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={appearance.undoHint}
          accessibilityState={{ disabled: !canUndo }}
          disabled={!canUndo}
          onPress={onUndo}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="undo-variant" size={24} color={canUndo ? colors.ink : colors.disabledInk} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={appearance.resetHint}
          onPress={onReset}
          style={styles.textButton}
        >
          <Text style={[type.link, { color: colors.lotus }]}>{appearance.reset}</Text>
        </Pressable>
      </View>

      <View style={styles.tabsPad}>
        <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={appearance.customizeTab}
            accessibilityState={{ selected: editorTab === "customize" }}
            onPress={() => setEditorTab("customize")}
            style={[styles.tab, editorTab === "customize" ? { backgroundColor: colors.cta } : null]}
          >
            <Text style={[type.label, { color: editorTab === "customize" ? colors.onCta : colors.ink }]}>
              {appearance.customizeTab}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={appearance.previewTab}
            accessibilityState={{ selected: editorTab === "preview" }}
            onPress={() => setEditorTab("preview")}
            style={[styles.tab, editorTab === "preview" ? { backgroundColor: colors.cta } : null]}
          >
            <Text style={[type.label, { color: editorTab === "preview" ? colors.onCta : colors.ink }]}>
              {appearance.previewTab}
            </Text>
          </Pressable>
        </View>
      </View>

      {editorTab === "preview" ? (
        <View style={[styles.flex, { backgroundColor: draftBuilt.colors.bg }]}>
          <View style={[styles.previewBar, { backgroundColor: colors.surface }]}>
            <Text style={[type.caption, styles.previewLabel, styles.flex, { color: colors.inkMuted }]}>
              {appearance.previewLabel} · {presetLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={appearance.fullPreview}
              accessibilityHint={appearance.fullPreviewHint}
              onPress={() => setFullPreview(true)}
              style={styles.textButton}
            >
              <Text style={[type.link, { color: colors.lotus }]}>{appearance.fullPreview}</Text>
            </Pressable>
          </View>
          <ScrollView style={{ backgroundColor: draftBuilt.colors.bg }}>
            <ThemeScope colors={draftColors} typography={draftTypography} layout={draftLayout}>
              <AppearancePreview />
            </ThemeScope>
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        style={editorTab === "customize" ? styles.flex : styles.hidden}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.controls}
      >
        {issues.length > 0 ? <ContrastIssues issues={issues} onFix={fixIssue} /> : null}

        <Section
          title={appearance.sections.theme}
          onReset={() => onResetSection("theme", appearance.sections.theme)}
        >
          <View style={styles.presetGrid}>
            {PRESET_IDS.map((id) => {
              const selected = draft.presetId === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => pickPreset(id)}
                  style={[
                    styles.presetChip,
                    {
                      borderColor: selected ? colors.ink : colors.line,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                    },
                  ]}
                >
                  <Text style={[type.label, { color: colors.ink }]}>{appearance.presets[id]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label text={appearance.sections.brightness} />
          <Segmented
            accessibilityLabel={appearance.sections.brightness}
            options={options(BRIGHTNESS_MODES, appearance.modes)}
            value={draft.settings.mode}
            onChange={(mode) => update({ mode })}
          />
          {draft.settings.mode === "system" ? (
            <>
              <Label text={appearance.sections.darkVariant} />
              <Segmented
                accessibilityLabel={appearance.sections.darkVariant}
                options={options(DARK_VARIANTS, appearance.darkVariants)}
                value={draft.settings.systemDarkVariant}
                onChange={(systemDarkVariant) => update({ systemDarkVariant })}
              />
            </>
          ) : null}
        </Section>

        <Section
          title={appearance.sections.text}
          onReset={() => onResetSection("text", appearance.sections.text)}
        >
          <Label text={appearance.sections.fontFamily} />
          <Text style={[type.caption, { color: colors.inkMuted }]}>{appearance.sections.fontFamilyHint}</Text>
          <View accessibilityRole="radiogroup" style={styles.fontList}>
            {FONT_FAMILY_IDS.map((id) => {
              const def = BODY_FONTS[id];
              const selected = draft.settings.fontFamily === id;
              const loading = pendingFont === id;
              const face = isFamilyLoaded(id) ? def.faces.regular : undefined;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, busy: loading }}
                  accessibilityLabel={def.label}
                  accessibilityHint={loading ? appearance.fontLoading : undefined}
                  onPress={() => selectFont(id)}
                  style={[
                    styles.fontRow,
                    { borderColor: selected ? colors.ink : colors.line, backgroundColor: colors.surface },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.lotus} style={styles.fontSpinner} />
                  ) : (
                    <MaterialCommunityIcons
                      name={selected ? "radiobox-marked" : "radiobox-blank"}
                      size={22}
                      color={selected ? colors.lotus : colors.inkMuted}
                    />
                  )}
                  <View style={styles.flex}>
                    <Text style={[type.body, face ? { fontFamily: face } : null, { color: colors.ink }]}>
                      {def.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[type.caption, face ? { fontFamily: face } : null, { color: colors.inkMuted }]}
                    >
                      {appearance.fontSample}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <TrackSlider
            label={appearance.sections.fontScale}
            value={draft.settings.fontScale}
            {...NUMERIC_RANGES.fontScale}
            onChange={(fontScale) => update({ fontScale })}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onSlidingChange={onSlidingChange}
          />
          <Text style={[type.caption, { color: colors.inkMuted }]}>{appearance.sections.fontScaleHint}</Text>

          <Label text={appearance.sections.fontWeight} />
          <Segmented
            accessibilityLabel={appearance.sections.fontWeight}
            options={options(FONT_WEIGHTS, appearance.weights)}
            value={draft.settings.fontWeight}
            onChange={(fontWeight) => update({ fontWeight })}
          />

          <TrackSlider
            label={appearance.sections.lineHeight}
            value={draft.settings.lineHeight}
            {...NUMERIC_RANGES.lineHeight}
            onChange={(lineHeight) => update({ lineHeight })}
            formatValue={(v) => `${v.toFixed(2)}×`}
            onSlidingChange={onSlidingChange}
          />
          <TrackSlider
            label={appearance.sections.letterSpacing}
            value={draft.settings.letterSpacing}
            {...NUMERIC_RANGES.letterSpacing}
            onChange={(letterSpacing) => update({ letterSpacing })}
            formatValue={(v) => `${v.toFixed(2)} em`}
            onSlidingChange={onSlidingChange}
          />
        </Section>

        <Section
          title={appearance.sections.colors}
          onReset={() => onResetSection("colors", appearance.sections.colors)}
        >
          <Segmented
            accessibilityLabel={appearance.sections.colors}
            options={options(COLOR_ROLES, appearance.colorRoles)}
            value={colorRole}
            onChange={setColorRole}
          />
          <SwatchRow
            label={appearance.colorRoles[colorRole]}
            swatches={SWATCHES[colorRole]}
            value={roleValue}
            onChange={(hex) => setRoleColor(colorRole, hex)}
          />
          <HexField value={roleValue ?? roleEffective} onCommit={(hex) => setRoleColor(colorRole, hex)} />
          <HsvPicker
            value={roleValue ?? roleEffective}
            onChange={(hex) => setRoleColor(colorRole, hex)}
            onSlidingChange={onSlidingChange}
          />
        </Section>

        <Section
          title={appearance.sections.layout}
          onReset={() => onResetSection("layout", appearance.sections.layout)}
        >
          <Label text={appearance.sections.radius} />
          <Segmented
            accessibilityLabel={appearance.sections.radius}
            options={options(RADIUS_SCALES, appearance.radii)}
            value={draft.settings.radiusScale}
            onChange={(radiusScale) => update({ radiusScale })}
          />
          <Label text={appearance.sections.density} />
          <Segmented
            accessibilityLabel={appearance.sections.density}
            options={options(DENSITIES, appearance.densities)}
            value={draft.settings.density}
            onChange={(density) => update({ density })}
          />
        </Section>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.sm,
            borderTopColor: colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {undoSnack ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.snackbar, { backgroundColor: colors.surfaceMuted, borderColor: colors.line }]}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
            <Text style={[type.label, styles.flex, { color: colors.ink }]}>{appearance.applied}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={appearance.undoApplyHint}
              onPress={onSnackUndo}
              style={styles.textButton}
            >
              <Text style={[type.link, { color: colors.lotus }]}>{appearance.undo}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={[styles.footerButton, styles.bordered, { borderColor: colors.controlBorder }]}
          >
            <Text style={[type.cta, { color: colors.ink }]}>{appearance.cancel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !isDirty }}
            disabled={!isDirty}
            onPress={onApply}
            style={[styles.footerButton, { backgroundColor: isDirty ? colors.cta : colors.disabledFill }]}
          >
            <Text style={[type.cta, { color: isDirty ? colors.onCta : colors.disabledInk }]}>
              {appearance.apply}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Section({ title, onReset, children }: { title: string; onReset?: () => void; children: ReactNode }) {
  const { colors } = useThemePreference();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.sectionHead}>
        <Text
          accessibilityRole="header"
          style={[type.label, styles.sectionTitle, styles.flex, { color: colors.lotus }]}
        >
          {title}
        </Text>
        {onReset ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${appearance.resetSection}: ${title}`}
            onPress={onReset}
            style={styles.textButton}
          >
            <Text style={[type.link, { color: colors.lotus }]}>{appearance.resetSection}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useThemePreference();
  return <Text style={[type.label, { color: colors.ink }]}>{text}</Text>;
}

function ContrastIssues({ issues, onFix }: { issues: ContrastCheck[]; onFix: (check: ContrastCheck) => void }) {
  const { colors } = useThemePreference();
  const severe = issues.some((check) => check.level === "severe");
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.issues, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
    >
      <View style={styles.issueHead}>
        <MaterialCommunityIcons name="alert-outline" size={22} color={colors.danger} />
        <Text style={[type.label, styles.flex, { color: colors.ink }]}>
          {severe ? appearance.contrast.severeTitle : appearance.contrast.warnTitle}
        </Text>
      </View>
      {issues.map((check) => (
        <View key={check.id} style={styles.issueRow}>
          <View style={[styles.issueSample, { backgroundColor: check.bg, borderColor: colors.line }]}>
            <Text style={[type.label, { color: check.fg }]}>Aa</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[type.caption, { color: colors.ink }]}>{appearance.contrast.pairs[check.id]}</Text>
            <Text style={[type.caption, { color: colors.ink }]}>
              {appearance.contrast.warn(formatRatio(check.ratio), check.required.toFixed(1))}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${appearance.contrast.fix}: ${appearance.contrast.pairs[check.id]}`}
            onPress={() => onFix(check)}
            style={styles.textButton}
          >
            <Text style={[type.link, { color: colors.ink }]}>{appearance.contrast.fix}</Text>
          </Pressable>
        </View>
      ))}
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
  headerTitle: { flex: 1, flexShrink: 1 },
  tabsPad: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tabs: { flexDirection: "row", borderRadius: radius.pill, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  hidden: { display: "none" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  textButton: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing.sm, justifyContent: "center" },
  previewFrame: { borderBottomWidth: StyleSheet.hairlineWidth },
  previewBar: { flexDirection: "row", alignItems: "center", paddingRight: spacing.sm },
  previewLabel: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  controls: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  section: {
    borderWidth: 1,
    borderRadius: radius.panel,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { letterSpacing: 0.8, textTransform: "uppercase" },
  fontSpinner: { width: 22, height: 22 },
  snackbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.field,
    borderCurve: "continuous",
    paddingLeft: spacing.md,
    minHeight: 48,
  },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  presetChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  fontList: { gap: spacing.xs },
  fontRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.field,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  issues: {
    borderWidth: 1,
    borderRadius: radius.panel,
    borderCurve: "continuous",
    padding: spacing.md,
    gap: spacing.sm,
  },
  issueHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  issueRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  issueSample: {
    width: 44,
    height: 44,
    borderRadius: radius.field,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  footerRow: { flexDirection: "row", gap: spacing.sm },
  footerButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.field,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  bordered: { borderWidth: 1 },
});
