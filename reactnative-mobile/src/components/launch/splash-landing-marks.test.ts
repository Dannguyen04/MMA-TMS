import {
  BRAND_MARK_EXISTS,
  FRACTURE_TITLE_USES_BRAND_MARK,
  fractureTitleLayout,
  SplashLandingMarks,
} from "@/components/launch/splash-landing-marks";
import { splash } from "@/theme/splash";
import { fonts } from "@/theme/typography";

describe("Legacy Fracture Title helpers", () => {
  it("does not use brand-mark.png as the primary lockup", () => {
    expect(FRACTURE_TITLE_USES_BRAND_MARK).toBe(false);
    expect(BRAND_MARK_EXISTS).toBe(false);
  });

  it("keeps stacked type geometry for diagnostics", () => {
    const layout = fractureTitleLayout(390, 844);
    expect(layout.titleSize).toBeGreaterThan(40);
    expect(layout.slitW).toBeGreaterThan(20);
    expect(layout.visionY).toBeGreaterThan(layout.mmaY);
    expect(layout.slitY).toBeGreaterThan(layout.mmaY - layout.titleSize);
    expect(layout.slitY).toBeLessThan(layout.visionY);
  });

  it("uses displayBlack and splash crimson tokens", () => {
    expect(fonts.displayBlack).toContain("Black");
    expect(splash.crimson).toBe("#ff2d55");
  });

  it("no longer paints the hold poster (HUD is SplashHudOverlay)", () => {
    expect(SplashLandingMarks).toBeTruthy();
    expect(FRACTURE_TITLE_USES_BRAND_MARK).toBe(false);
  });
});
