import { buildFireScene, flameStrength, introFrame, INTRO_H, INTRO_W, NAME_BOX } from "./fire-intro-scene";

describe("fire intro scene", () => {
  const scene = buildFireScene();

  it("is deterministic, so every launch burns the same way", () => {
    const again = buildFireScene();
    expect(Array.from(again.embers)).toEqual(Array.from(scene.embers));
    expect(Array.from(again.flames)).toEqual(Array.from(scene.flames));
  });

  it("packs 620 embers and a few hundred flames into static buffers", () => {
    expect(scene.emberCount).toBe(620);
    expect(scene.embers.length).toBe(620 * 10);
    expect(scene.flames.length).toBe(scene.flameCount * 8);
    expect(scene.flameCount).toBeGreaterThan(300);
    expect(scene.flameCount).toBeLessThan(1200);
  });

  it("lands every ember on a point of the name", () => {
    for (let i = 0; i < scene.emberCount; i++) {
      const tx = scene.embers[i * 10 + 6];
      const ty = scene.embers[i * 10 + 7];
      expect(tx).toBeGreaterThanOrEqual(NAME_BOX.x);
      expect(tx).toBeLessThanOrEqual(NAME_BOX.x + NAME_BOX.w);
      expect(ty).toBeGreaterThanOrEqual(NAME_BOX.y);
      expect(ty).toBeLessThanOrEqual(NAME_BOX.y + NAME_BOX.h);
    }
  });

  it("uses all three flame kinds (glove, sphere, name)", () => {
    const kinds = new Set<number>();
    for (let i = 0; i < scene.flameCount; i++) kinds.add(scene.flames[i * 8 + 7]);
    expect([...kinds].sort()).toEqual([0, 1, 2]);
  });

  it("keeps the name burning during the hold, after the glove and sphere are out", () => {
    const [glove, sphere, name] = flameStrength(3000);
    expect(glove).toBe(0);
    expect(sphere).toBe(0);
    expect(name).toBeCloseTo(0.5);
  });

  it("maps the design frame with cover scaling", () => {
    const tall = introFrame(360, 900);
    expect(tall.u).toBeCloseTo(900 / INTRO_H);
    expect(tall.oy).toBeCloseTo(0);
    expect(tall.ox).toBeLessThan(0);
    const wide = introFrame(800, 844);
    expect(wide.u).toBeCloseTo(800 / INTRO_W);
    expect(wide.ox).toBeCloseTo(0);
  });
});
