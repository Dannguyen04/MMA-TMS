import { describe, expect, it } from "vitest";

import { figureParams } from "../figure-params";
import { bodyModelFor, figureBuild } from "./build";

describe("bodyModelFor", () => {
    it("draws the scanned male model only for male fighters", () => {
        expect(bodyModelFor("male")).toBe("muscular");
        expect(bodyModelFor("female")).toBe("mannequin");
        expect(bodyModelFor(undefined)).toBe("mannequin");
    });
});

describe("figureBuild", () => {
    it("scales to the fighter's height", () => {
        const tall = figureBuild(figureParams({ sex: "male", heightCm: 192.5, weightKg: 84, bodyFatPct: 12, stance: "orthodox", healthStatus: "healthy" }));
        expect(tall.height).toBeCloseTo(1.1, 2);
        const short = figureBuild(figureParams({ sex: "female", heightCm: 157.5, weightKg: 52, bodyFatPct: 18, stance: "orthodox", healthStatus: "healthy" }));
        expect(short.height).toBeCloseTo(0.9, 2);
    });

    it("widens with BMI inside a narrow band", () => {
        const light = figureBuild(figureParams({ sex: "male", heightCm: 180, weightKg: 60, bodyFatPct: 8, stance: "orthodox", healthStatus: "healthy" }));
        const heavy = figureBuild(figureParams({ sex: "male", heightCm: 180, weightKg: 115, bodyFatPct: 25, stance: "orthodox", healthStatus: "healthy" }));
        expect(heavy.width).toBeGreaterThan(light.width);
        expect(light.width).toBeGreaterThanOrEqual(0.9);
        expect(heavy.width).toBeLessThanOrEqual(1.12);
    });
});
