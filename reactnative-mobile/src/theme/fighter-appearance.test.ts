import {
  appearanceStorageKey,
  DEFAULT_APPEARANCE,
} from "@/theme/appearance/settings";
import {
  APPEARANCE_SAVE_ERROR,
  beginAppearanceApply,
  failAppearanceApply,
  fighterAppearanceStorageKey,
  fighterDraftToShared,
  FIGHTER_APPEARANCE_DEVICE_KEY,
  finishAppearanceApply,
  parseFighterAppearance,
  readFighterAppearance,
  writeAppliedFighterAppearance,
  type AppearanceKeyValue,
  type EditorSnapshot,
} from "@/theme/fighter-appearance";
import {
  DEFAULT_APPEARANCE_DRAFT,
  resetAppearanceGroup,
} from "@/screens/fighter/redesign/appearance-model";

function memoryStore(): AppearanceKeyValue & { snapshot(): Record<string, string> } {
  const data = new Map<string, string>();
  return {
    snapshot: () => Object.fromEntries(data),
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    multiSet: async (pairs) => {
      for (const [key, value] of pairs) data.set(key, value);
    },
  };
}

function editor(applied = DEFAULT_APPEARANCE_DRAFT): EditorSnapshot {
  return { applied, draft: applied, saving: false, error: null };
}

describe("fighter appearance persistence", () => {
  it("keeps a draft out of storage until apply", async () => {
    const storage = memoryStore();
    const applied = DEFAULT_APPEARANCE_DRAFT;
    const draft = { ...applied, theme: "paper" as const, accent: "blue" as const };
    expect(await readFighterAppearance("fighter-a", storage)).toBeNull();
    expect(storage.snapshot()).toEqual({});
    expect(draft.theme).toBe("paper");
    expect(applied.theme).toBe("default");
  });

  it("persists on apply and reloads the same draft", async () => {
    const storage = memoryStore();
    const draft = {
      ...DEFAULT_APPEARANCE_DRAFT,
      theme: "paper" as const,
      mode: "light" as const,
      accent: "blue" as const,
      typeSize: "large" as const,
    };
    const shared = fighterDraftToShared(draft, DEFAULT_APPEARANCE);
    await writeAppliedFighterAppearance("fighter-a", draft, shared, storage);
    await expect(readFighterAppearance("fighter-a", storage)).resolves.toEqual(draft);
    const raw = await storage.getItem(appearanceStorageKey("fighter-a"));
    expect(raw).toContain("\"presetId\":\"light\"");
    expect(shared.settings.mode).toBe("light");
    expect(shared.settings.fontFamily).toBe("inter");
    expect(shared.settings.fontScale).toBe(1.15);
    expect(shared.settings.backgroundColor).toBe("#F4ECD8");
    expect(shared.settings.accentColor).toBe("#4878AB");
  });

  it("saves defaults after a scoped reset", async () => {
    const storage = memoryStore();
    const edited = {
      ...DEFAULT_APPEARANCE_DRAFT,
      theme: "paper" as const,
      reading: "highContrast" as const,
      accent: "purple" as const,
      mode: "dark" as const,
    };
    const themeReset = resetAppearanceGroup(edited, "theme");
    expect(themeReset.theme).toBe("default");
    expect(themeReset.reading).toBe("highContrast");
    const readingReset = resetAppearanceGroup(themeReset, "reading");
    expect(readingReset).toEqual({ ...DEFAULT_APPEARANCE_DRAFT, accent: "purple", mode: "dark" });
    await writeAppliedFighterAppearance(
      "fighter-a",
      DEFAULT_APPEARANCE_DRAFT,
      fighterDraftToShared(DEFAULT_APPEARANCE_DRAFT, DEFAULT_APPEARANCE),
      storage,
    );
    await expect(readFighterAppearance("fighter-a", storage)).resolves.toEqual(DEFAULT_APPEARANCE_DRAFT);
  });

  it("isolates accounts and keeps a saved config after switching away", async () => {
    const storage = memoryStore();
    const paper = { ...DEFAULT_APPEARANCE_DRAFT, theme: "paper" as const };
    const mint = { ...DEFAULT_APPEARANCE_DRAFT, theme: "mint" as const, mode: "dark" as const };
    await writeAppliedFighterAppearance("fighter-a", paper, fighterDraftToShared(paper, DEFAULT_APPEARANCE), storage);
    await writeAppliedFighterAppearance("fighter-b", mint, fighterDraftToShared(mint, DEFAULT_APPEARANCE), storage);
    await writeAppliedFighterAppearance(null, DEFAULT_APPEARANCE_DRAFT, fighterDraftToShared(DEFAULT_APPEARANCE_DRAFT, DEFAULT_APPEARANCE), storage);

    expect(fighterAppearanceStorageKey("fighter-a")).toBe("mma.ui.fighterAppearance.v1.user.fighter-a");
    expect(fighterAppearanceStorageKey("fighter-b")).not.toBe(fighterAppearanceStorageKey("fighter-a"));
    expect(fighterAppearanceStorageKey(null)).toBe(FIGHTER_APPEARANCE_DEVICE_KEY);
    expect(fighterAppearanceStorageKey("  ")).toBe(FIGHTER_APPEARANCE_DEVICE_KEY);
    expect(appearanceStorageKey("fighter-a")).toBe("mma.ui.appearance.v1.user.fighter-a");
    expect(appearanceStorageKey(null)).toBe("mma.ui.appearance.v1.device");

    await expect(readFighterAppearance("fighter-a", storage)).resolves.toEqual(paper);
    await expect(readFighterAppearance("fighter-b", storage)).resolves.toEqual(mint);
    await expect(readFighterAppearance(null, storage)).resolves.toEqual(DEFAULT_APPEARANCE_DRAFT);
    expect(Object.keys(storage.snapshot()).some((key) => key.includes("fighter-a"))).toBe(true);
  });

  it("leaves storage and the applied draft unchanged when the write fails", async () => {
    const storage = memoryStore();
    const applied = DEFAULT_APPEARANCE_DRAFT;
    const draft = { ...applied, reading: "highContrast" as const };
    await writeAppliedFighterAppearance("fighter-a", applied, fighterDraftToShared(applied, DEFAULT_APPEARANCE), storage);
    storage.multiSet = async () => {
      throw new Error("disk");
    };
    await expect(
      writeAppliedFighterAppearance("fighter-a", draft, fighterDraftToShared(draft, DEFAULT_APPEARANCE), storage),
    ).rejects.toThrow("disk");
    await expect(readFighterAppearance("fighter-a", storage)).resolves.toEqual(applied);
    expect(draft.reading).toBe("highContrast");
    expect(parseFighterAppearance("{")).toBeNull();
  });

  it("blocks a second apply and keeps the draft when save fails", () => {
    const dirty = { ...editor(), draft: { ...DEFAULT_APPEARANCE_DRAFT, theme: "paper" as const } };
    const saving = beginAppearanceApply(dirty);
    expect(saving.saving).toBe(true);
    expect(beginAppearanceApply(saving)).toBe(saving);
    const failed = failAppearanceApply(saving);
    expect(failed.draft.theme).toBe("paper");
    expect(failed.applied).toEqual(DEFAULT_APPEARANCE_DRAFT);
    expect(failed.error).toBe(APPEARANCE_SAVE_ERROR);
    expect(failed.saving).toBe(false);
    const saved = finishAppearanceApply(saving, dirty.draft);
    expect(saved.applied.theme).toBe("paper");
    expect(saved.draft).toEqual(saved.applied);
    expect(saved.error).toBeNull();
  });
});
