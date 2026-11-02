import { describe, expect, it } from "vitest";

import { figureParams, type FigureSource } from "./figure-params";

const base: FigureSource = { sex: "male", heightCm: 175, weightKg: 70, bodyFatPct: 10, stance: "orthodox", healthStatus: "healthy" };

describe("figureParams", () => {
    it("reads height, build and lead hand from the fighter record", () => {
        const params = figureParams(base);
        expect(params).toMatchObject({ sex: "male", height: 1.75, lead: "left", softness: 0 });
        expect(params.bulk).toBeCloseTo(0.86 + (70 / 1.75 ** 2 - 20) * 0.035, 3);
    });

    it("leads with the right hand for a southpaw only", () => {
        expect(figureParams({ ...base, stance: "southpaw" }).lead).toBe("right");
        expect(figureParams({ ...base, stance: "switch" }).lead).toBe("left");
        expect(figureParams({ ...base, stance: null }).lead).toBe("left");
    });

    it("makes a heavier fighter bulkier and caps the extremes", () => {
        expect(figureParams({ ...base, weightKg: 93 }).bulk).toBeGreaterThan(figureParams(base).bulk);
        expect(figureParams({ ...base, weightKg: 200 }).bulk).toBe(1.28);
        expect(figureParams({ ...base, weightKg: 35 }).bulk).toBe(0.84);
    });

    it("falls back to an average build for the sex when fields are missing", () => {
        const params = figureParams({ ...base, sex: "female", heightCm: null, weightKg: null, bodyFatPct: null });
        expect(params).toMatchObject({ sex: "female", height: 1.65, softness: 0 });
        expect(figureParams({ ...base, sex: null }).sex).toBe("male");
    });

    it("adds waist softness above the lean body-fat baseline", () => {
        expect(figureParams({ ...base, bodyFatPct: 20 }).softness).toBeCloseTo(0.06, 3);
        expect(figureParams({ ...base, sex: "female", bodyFatPct: 18 }).softness).toBe(0);
    });
});
