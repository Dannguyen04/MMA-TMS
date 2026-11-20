import { KEYBOARD_GAP, revealOffset } from "./keyboard-aware";

describe("revealOffset", () => {
  const viewport = 400;

  it("leaves a field that already shows", () => {
    expect(revealOffset({ y: 100, height: 50 }, 0, viewport)).toBeNull();
  });

  it("scrolls a field below the visible part up to sit above the bottom edge", () => {
    expect(revealOffset({ y: 600, height: 50 }, 0, viewport)).toBe(600 + 50 + KEYBOARD_GAP - viewport);
  });

  it("scrolls back down to a field above the visible part", () => {
    expect(revealOffset({ y: 100, height: 50 }, 300, viewport)).toBe(100 - KEYBOARD_GAP);
  });

  it("keeps the top of a field taller than the viewport in view", () => {
    expect(revealOffset({ y: 600, height: 500 }, 0, viewport)).toBe(600 - KEYBOARD_GAP);
  });

  it("never scrolls above the start", () => {
    expect(revealOffset({ y: 10, height: 20 }, 200, viewport)).toBe(0);
  });
});
