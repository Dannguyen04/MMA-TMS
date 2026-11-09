import { describe, expect, it } from "vitest";

import { makeBody } from "./materials";
import { PAINT } from "./regions";

describe("body hologram material", () => {
    it("keeps the light-theme body as transparent as the dark hologram", () => {
        const face = [0, 0, 0, 1, 0] as const;
        const dark = makeBody(face, false);
        const light = makeBody(face, true);
        expect(dark.transparent).toBe(true);
        expect(light.transparent).toBe(true);
        expect(light.depthWrite).toBe(false);
        expect(dark.uniforms.uBase.value).toBe(PAINT.bodyOpacity);
        expect(light.uniforms.uBase.value).toBe(PAINT.bodyOpacity);
        expect(light.uniforms.uBase.value).toBeLessThan(0.25);
        const lightTint = light.uniforms.uTint.value;
        const darkTint = dark.uniforms.uTint.value;
        expect(lightTint.b).toBeGreaterThan(lightTint.r);
        expect(darkTint.r).toBeCloseTo(0.55);
    });
});
