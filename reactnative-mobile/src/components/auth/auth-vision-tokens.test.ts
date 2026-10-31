import { authCanvasSize, authDark, visionAuthCanvas } from "@/components/auth/auth-vision-tokens";
import {
  resolvePreset,
  serializeAppearance,
  type AppliedAppearance,
} from "@/theme/appearance/settings";

const lightSaved: AppliedAppearance = {
  presetId: "light",
  settings: {
    ...resolvePreset("light"),
    accentColor: "#1F5FBF",
    fontFamily: "lexend",
    fontScale: 1.3,
  },
};

describe("vision auth canvas", () => {
  it("keeps login, email, and code dark without changing the saved appearance payload", () => {
    const savedBackground = "#F7F4EE";
    const before = JSON.parse(serializeAppearance(lightSaved)) as { updatedAt?: string };
    delete before.updatedAt;

    expect(visionAuthCanvas("login", savedBackground)).toBe(authDark.canvas);
    expect(visionAuthCanvas("register", savedBackground)).toBe(authDark.canvas);
    expect(visionAuthCanvas(undefined, savedBackground)).toBe(authDark.canvas);
    expect(visionAuthCanvas("forgot-password", savedBackground)).toBe(authDark.canvas);

    const after = JSON.parse(serializeAppearance(lightSaved)) as { updatedAt?: string };
    delete after.updatedAt;
    expect(after).toEqual(before);
    expect(lightSaved.presetId).toBe("light");
    expect(lightSaved.settings.accentColor).toBe("#1F5FBF");
    expect(lightSaved.settings.fontFamily).toBe("lexend");
    expect(lightSaved.settings.fontScale).toBe(1.3);
    expect(authDark.gold).toBe("#D5B16B");
    expect(authDark.canvas).not.toBe(savedBackground);
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
