import { type, viLineHeight } from "@/theme/typography";

const VI_UI_ROLES = ["title", "body", "label", "link", "caption", "cta", "academy"] as const;

describe("typography", () => {
  it("gives Vietnamese UI tokens room for diacritics", () => {
    for (const role of VI_UI_ROLES) {
      const style = type[role];
      expect(style.lineHeight).toBeGreaterThanOrEqual(viLineHeight(style.fontSize));
    }
  });

  it("never sets lineHeight below fontSize", () => {
    for (const [role, style] of Object.entries(type)) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
      void role;
    }
  });
});
