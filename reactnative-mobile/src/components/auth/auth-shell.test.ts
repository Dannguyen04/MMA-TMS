import { nextContentOffsetY } from "@/components/auth/auth-shell";

describe("nextContentOffsetY", () => {
  it("adds overflow onto the current content offset", () => {
    expect(nextContentOffsetY(80, 40)).toBe(120);
    expect(nextContentOffsetY(80, 0)).toBe(80);
    expect(nextContentOffsetY(80, -12)).toBe(80);
  });
});
