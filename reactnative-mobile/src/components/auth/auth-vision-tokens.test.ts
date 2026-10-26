import { renderHook } from "@testing-library/react-native";
import * as RN from "react-native";

import { authCanvasSize, authPalette, useAuthColors, visionAuthCanvas } from "@/components/auth/auth-vision-tokens";
import { palettes } from "@/theme/colors";
import {
  resolvePreset,
  serializeAppearance,
  type AppliedAppearance,
} from "@/theme/appearance/settings";

const lightSaved: AppliedAppearance = {
  presetId: "system",
  settings: {
    ...resolvePreset("system"),
    mode: "light",
    accentColor: "#1F5FBF",
    fontFamily: "lexend",
    fontScale: 1.3,
  },
};

describe("vision auth canvas", () => {
  it("uses the default palette for the system scheme, never the saved appearance", () => {
    const savedBackground = "#F7F4EE";
    const before = JSON.parse(serializeAppearance(lightSaved)) as { updatedAt?: string };
    delete before.updatedAt;

    expect(visionAuthCanvas("login", savedBackground, "dark")).toBe(palettes.dark.bg);
    expect(visionAuthCanvas("register", savedBackground, "light")).toBe(palettes.light.bg);
    expect(visionAuthCanvas(undefined, savedBackground, "dark")).toBe(palettes.dark.bg);
    expect(visionAuthCanvas("forgot-password", savedBackground, "light")).toBe(palettes.light.bg);

    const after = JSON.parse(serializeAppearance(lightSaved)) as { updatedAt?: string };
    delete after.updatedAt;
    expect(after).toEqual(before);
    expect(lightSaved.presetId).toBe("system");
    expect(lightSaved.settings.accentColor).toBe("#1F5FBF");
    expect(lightSaved.settings.fontFamily).toBe("lexend");
    expect(lightSaved.settings.fontScale).toBe(1.3);
    expect(authPalette("light").buttonOn).toBe(palettes.light.cta);
    expect(authPalette("dark").accent).toBe(palettes.dark.lotus);
    expect(authPalette("light").canvas).not.toBe(savedBackground);
  });
});

describe("auth canvas size", () => {
  it("uses the full phone width and the full viewport height", () => {
    expect(authCanvasSize(390, 844)).toEqual({ width: 390, height: 844 });
  });

  it("keeps a phone-width column as tall as an iPad or desktop window", () => {
    expect(authCanvasSize(1032, 1376)).toEqual({ width: 430, height: 1376 });
    expect(authCanvasSize(1440, 900)).toEqual({ width: 430, height: 900 });
  });
});

describe("auth screens stay fixed dark", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(["light", "dark", null] as const)("system scheme %s still renders the dark auth palette with the new accent", async (scheme) => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);
    const { result } = await renderHook(() => useAuthColors());
    expect(result.current).toEqual(authPalette("dark"));
    expect(result.current.canvas).toBe(palettes.dark.bg);
    expect(result.current.buttonOn).toBe("#C23A22");
    expect(result.current.accent).toBe("#FF8066");
  });
});
