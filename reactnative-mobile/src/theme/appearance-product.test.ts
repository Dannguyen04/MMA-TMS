import AsyncStorage from "@react-native-async-storage/async-storage";

import { roleMayReadMeasurements } from "@/api/role-contracts";
import {
  initialBodyChrome,
  keepBodyChrome,
  measurementAvailability,
  selectBodySection,
  withExamFilter,
  withExamReason,
} from "@/screens/fighter/redesign/body-section";
import { headerTitleLayout } from "@/screens/fighter/redesign/header-layout";
import { paletteFromTokens } from "@/screens/fighter/redesign/palette";
import { contrastRatio } from "@/theme/appearance/color-math";
import {
  appearanceEqual,
  appearanceStorageKey,
  DEFAULT_APPEARANCE,
  DEFAULT_SETTINGS,
  parseStoredAppearance,
  readAppearance,
  resetAppearanceSection,
  resolvePreset,
  serializeAppearance,
  shouldAnnounceApplySuccess,
  withBrightnessMode,
  writeAppearance,
  type AppliedAppearance,
} from "@/theme/appearance/settings";
import { buildColors, buildTypography } from "@/theme/appearance/tokens";

function paperWithAccent(): AppliedAppearance {
  return {
    presetId: "paper",
    settings: {
      ...resolvePreset("paper"),
      accentColor: "#1F5FBF",
      fontFamily: "lexend",
      fontScale: 1.3,
    },
  };
}

describe("saved appearance", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("loads a saved theme per account and does not let another account overwrite it", async () => {
    const first = paperWithAccent();
    const second: AppliedAppearance = {
      presetId: "mint",
      settings: { ...resolvePreset("mint"), fontFamily: "literata" },
    };
    await writeAppearance(first, "user-a");
    await writeAppearance(second, "user-b");

    expect(appearanceStorageKey("user-a")).not.toBe(appearanceStorageKey("user-b"));
    const loadedA = await readAppearance("user-a");
    const loadedB = await readAppearance("user-b");
    expect(loadedA.applied.settings.accentColor).toBe("#1F5FBF");
    expect(loadedA.applied.settings.fontFamily).toBe("lexend");
    expect(loadedB.applied.settings.fontFamily).toBe("literata");
    expect(loadedB.applied.settings.accentColor).not.toBe("#1F5FBF");
  });

  it("keeps the same palette when the screen or Cơ thể section label changes", () => {
    const built = buildColors(paperWithAccent().settings, "light");
    const home = paletteFromTokens(built.colors);
    const bodyHealth = paletteFromTokens(built.colors);
    const bodyExam = paletteFromTokens(built.colors);
    expect(bodyHealth.bg).toBe(home.bg);
    expect(bodyExam.accent).toBe(home.accent);
    expect(bodyExam.ink).toBe(home.ink);
  });

  it("does not let a legacy mode string replace a valid stored document", () => {
    const stored = serializeAppearance(paperWithAccent());
    const parsed = parseStoredAppearance(stored, "dark");
    expect(parsed.source).toBe("stored");
    expect(parsed.applied.settings.fontFamily).toBe("lexend");
    expect(parsed.applied.settings.accentColor).toBe("#1F5FBF");
    expect(parsed.applied.settings.mode).toBe(paperWithAccent().settings.mode);
  });

  it("drops invalid fields and keeps the valid ones", () => {
    const raw = JSON.stringify({
      version: 1,
      presetId: "system",
      overrides: { fontFamily: "not-a-font", fontScale: 1.2, accentColor: "red" },
    });
    const parsed = parseStoredAppearance(raw, null);
    expect(parsed.applied.settings.fontScale).toBe(1.2);
    expect(parsed.applied.settings.fontFamily).toBe(DEFAULT_SETTINGS.fontFamily);
    expect(parsed.applied.settings.accentColor).toBeNull();
  });
});

describe("brightness and tokens", () => {
  it("changes only the display mode when switching light and dark", () => {
    const current = paperWithAccent();
    const dark = withBrightnessMode(current, "dark");
    expect(dark.settings.mode).toBe("dark");
    expect(dark.presetId).toBe("paper");
    expect(dark.settings.accentColor).toBe("#1F5FBF");
    expect(dark.settings.fontFamily).toBe("lexend");
    expect(dark.settings.fontScale).toBe(1.3);
    expect(dark.settings.backgroundColor).toBe(current.settings.backgroundColor);
  });

  it("applies accent, a supported font, and high contrast through the token builder", () => {
    const accented = buildColors(
      { ...DEFAULT_SETTINGS, accentColor: "#1F6B3A", fontFamily: "lexend", fontScale: 1.6 },
      "light",
    );
    expect(accented.colors.cta).toBe("#1F6B3A");
    expect(contrastRatio(accented.colors.onCta, accented.colors.cta)).toBeGreaterThanOrEqual(3);
    const type = buildTypography({ ...DEFAULT_SETTINGS, fontFamily: "lexend", fontScale: 1.6 }, 1, true);
    expect(type.family).toBe("lexend");
    expect(type.sizeFactor).toBeCloseTo(1.6);

    const contrast = buildColors(resolvePreset("highContrastLight"), "dark");
    expect(contrast.colors.bg).toBe("#FFFFFF");
    expect(contrast.colors.ink).toBe("#000000");
    expect(contrastRatio(contrast.colors.ink, contrast.colors.bg)).toBeGreaterThanOrEqual(4.5);

    const palette = paletteFromTokens(accented.colors);
    expect(palette.bg).toBe(accented.colors.bg);
    expect(palette.ink).toBe(accented.colors.ink);
    expect(palette.accent).toBe(accented.colors.cta);
    expect(palette.onAccent).toBe(accented.colors.onCta);
    expect(palette.warning).toBe(accented.colors.danger);
    expect(contrastRatio(palette.ink, palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(palette.agendaInk, palette.agenda)).toBeGreaterThanOrEqual(3);
  });
});

describe("draft, preview, and save", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("keeps the draft off storage until apply, and a group reset does not clear other groups", async () => {
    const applied = paperWithAccent();
    await writeAppearance(applied, "user-a");
    const edited: AppliedAppearance = {
      ...applied,
      settings: { ...applied.settings, fontScale: 1.5, accentColor: "#1F5FBF" },
    };
    const textReset = resetAppearanceSection(edited, "text");
    expect(textReset.settings.fontScale).toBe(DEFAULT_SETTINGS.fontScale);
    expect(textReset.settings.fontFamily).toBe(DEFAULT_SETTINGS.fontFamily);
    expect(textReset.settings.accentColor).toBe("#1F5FBF");
    const colorReset = resetAppearanceSection(edited, "colors");
    expect(colorReset.settings.accentColor).toBeNull();
    expect(colorReset.settings.fontScale).toBe(1.5);

    const still = await readAppearance("user-a");
    expect(appearanceEqual(still.applied, applied)).toBe(true);
    expect(appearanceEqual(DEFAULT_APPEARANCE, edited)).toBe(false);
  });

  it("treats cancel as the applied value and matches preview tokens to that value after apply", () => {
    const applied = paperWithAccent();
    const draft: AppliedAppearance = {
      ...applied,
      settings: { ...applied.settings, fontScale: 1.5 },
    };
    const cancelled = applied;
    expect(appearanceEqual(cancelled, applied)).toBe(true);
    const preview = buildColors(draft.settings, "light");
    const after = buildColors(draft.settings, "light");
    expect(preview.colors).toEqual(after.colors);
    expect(buildTypography(draft.settings, 1, true)).toEqual(buildTypography(draft.settings, 1, true));
  });

  it("does not announce success when storage rejects the write, and keeps the previous save", async () => {
    const applied = paperWithAccent();
    await writeAppearance(applied, "user-a");
    const setItem = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk"));
    const next: AppliedAppearance = {
      ...applied,
      settings: { ...applied.settings, accentColor: "#1F5FBF" },
    };
    await expect(writeAppearance(next, "user-a")).rejects.toThrow("disk");
    setItem.mockRestore();
    const loaded = await readAppearance("user-a");
    expect(loaded.applied.settings.accentColor).toBe("#1F5FBF");
    expect(shouldAnnounceApplySuccess(false)).toBe(false);
    expect(shouldAnnounceApplySuccess(true)).toBe(true);
  });
});

describe("Cơ thể sections and permissions", () => {
  it("keeps the exam reason, filter, and section when the theme is unchanged in that state", () => {
    const edited = withExamReason(withExamFilter(selectBodySection(initialBodyChrome(), "exam"), "OPEN"), "Đau vai trái");
    const afterTheme = keepBodyChrome(edited);
    expect(afterTheme.section).toBe("exam");
    expect(afterTheme.filter).toBe("OPEN");
    expect(afterTheme.reason).toBe("Đau vai trái");
    expect(afterTheme).toBe(edited);
  });

  it("does not offer measurement reads to fighter or doctor, and hides technical permission names", () => {
    expect(roleMayReadMeasurements("FIGHTER")).toBe(false);
    expect(roleMayReadMeasurements("DOCTOR")).toBe(false);
    expect(roleMayReadMeasurements("COACH")).toBe(true);
    expect(roleMayReadMeasurements("ADMIN")).toBe(true);
    const fighter = measurementAvailability("FIGHTER");
    const doctor = measurementAvailability("DOCTOR");
    expect(fighter.mayRead).toBe(false);
    expect(doctor.mayRead).toBe(false);
    expect(fighter.message).not.toMatch(/fighter\.measurement|GET \//);
    expect(doctor.message).not.toMatch(/fighter\.measurement|GET \//);
    expect(measurementAvailability("COACH").mayRead).toBe(true);
  });

  it("grows the header with large text and does not mark it clipped", () => {
    const live = buildTypography({ ...DEFAULT_SETTINGS, fontScale: 1.6 }, 1, true);
    const layout = headerTitleLayout("Buổi tập", live, 96);
    expect(layout.fontSize).toBeGreaterThan(22);
    expect(layout.lineHeight).toBeGreaterThanOrEqual(layout.fontSize);
    expect(layout.blockHeight).toBe(layout.lines * layout.lineHeight);
    expect(layout.clips).toBe(false);
  });
});
