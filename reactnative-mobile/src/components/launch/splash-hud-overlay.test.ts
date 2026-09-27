import {
  HUD_ENTER_MS,
  HUD_EXIT_MS,
  SLIT_MAX_WIDTH_RATIO,
  WAVE_TEX_SIZE,
  airCoverRadius,
  airVentOpacity,
  exitInkOpacity,
  exitSplitY,
  glyphReveal,
  splashSlitWidthRatio,
} from "@/components/launch/splash-hud-overlay";

describe("hold overlay cues", () => {
  it("plays an entrance before the bar and an exit after it", () => {
    expect(HUD_ENTER_MS).toBeGreaterThanOrEqual(400);
    expect(HUD_EXIT_MS).toBeGreaterThanOrEqual(360);
  });

  it("keeps wave textures small and fixed so scale stays on the UI thread", () => {
    expect(WAVE_TEX_SIZE).toBe(512);
    expect(WAVE_TEX_SIZE).toBeLessThan(800);
  });
});

describe("splashSlitWidthRatio", () => {
  it("maps 0→100 progress to 0→1 slit ratio", () => {
    expect(splashSlitWidthRatio(0)).toBe(0);
    expect(splashSlitWidthRatio(50)).toBe(0.5);
    expect(splashSlitWidthRatio(100)).toBe(1);
  });

  it("clamps out-of-range progress", () => {
    expect(splashSlitWidthRatio(-10)).toBe(0);
    expect(splashSlitWidthRatio(120)).toBe(1);
  });

  it("keeps the on-screen max width at 56% of the screen", () => {
    expect(SLIT_MAX_WIDTH_RATIO).toBe(0.56);
    const screenW = 390;
    expect(splashSlitWidthRatio(100) * screenW * SLIT_MAX_WIDTH_RATIO).toBeCloseTo(
      screenW * 0.56,
    );
    expect(splashSlitWidthRatio(70) * screenW * SLIT_MAX_WIDTH_RATIO).toBeCloseTo(
      screenW * 0.56 * 0.7,
    );
  });
});

describe("air field", () => {
  it("covers the pane from the crack to the far corner", () => {
    const radius = airCoverRadius(390, 844, 390 * 0.83, 844 * 0.3);
    expect(radius).toBeGreaterThan(390);
    expect(radius).toBeCloseTo(Math.hypot(390 * 0.83, 844 * 0.7), 0);
  });

  it("keeps a glyph dark until the front reaches it", () => {
    const feather = 80;
    expect(glyphReveal(0, 200, feather)).toBe(0);
    expect(glyphReveal(199, 200, feather)).toBe(0);
    expect(glyphReveal(200, 200, feather)).toBe(0);
    expect(glyphReveal(240, 200, feather)).toBeGreaterThan(0.4);
    expect(glyphReveal(200 + feather, 200, feather)).toBe(1);
  });

  it("does not light glyphs a full feather ahead of the front", () => {
    expect(glyphReveal(20, 200, 180)).toBe(0);
  });
});

describe("pressure release", () => {
  it("does not reverse the entrance", () => {
    expect(HUD_EXIT_MS).not.toBe(HUD_ENTER_MS);
  });

  it("thins the air in place instead of shrinking it", () => {
    expect(airVentOpacity(0)).toBeCloseTo(1);
    expect(airVentOpacity(0.1)).toBeGreaterThan(1);
    expect(airVentOpacity(1)).toBeCloseTo(0);
  });

  it("splits the lockup along the slit, then fades the ink", () => {
    expect(exitSplitY(0, 28)).toBe(0);
    expect(exitSplitY(1, 28)).toBeCloseTo(28);
    expect(exitInkOpacity(0)).toBe(1);
    expect(exitInkOpacity(0.2)).toBe(1);
    expect(exitInkOpacity(1)).toBe(0);
  });
});
