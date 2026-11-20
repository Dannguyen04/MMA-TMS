import { igniteBurst, igniteRing, ignitePower, outLift, outPower } from "./tab-fire";

describe("tab fire strength", () => {
  it("ignites from nothing, flares past full and settles at full", () => {
    expect(ignitePower(0)).toBe(0);
    expect(Math.max(...[100, 200, 300, 400].map(ignitePower))).toBeGreaterThan(1);
    expect(ignitePower(700)).toBeCloseTo(1);
    expect(ignitePower(5000)).toBeCloseTo(1);
  });

  it("blasts on ignition, then the blast and shock ring are gone", () => {
    expect(igniteBurst(0)).toBe(1);
    expect(igniteBurst(420)).toBe(0);
    expect(igniteRing(0)).toBe(0);
    expect(igniteRing(260)).toBeCloseTo(0.5);
    expect(igniteRing(520)).toBe(-1);
  });

  it("evaporates: thins from the strength it had while it rises away", () => {
    expect(outPower(0, 1)).toBeCloseTo(1);
    expect(outPower(300, 1)).toBeLessThan(1);
    expect(outPower(650, 1)).toBe(0);
    expect(outLift(0)).toBe(0);
    expect(outLift(325)).toBeGreaterThan(0.5);
    expect(outLift(650)).toBe(1);
  });
});
