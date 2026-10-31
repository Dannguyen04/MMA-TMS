import { describe, expect, it } from "vitest";

import {
    blockedTypesForMaxTier,
    DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
    maxAllowedTier,
    SESSION_INTENSITY_TIERS,
    tierOfTrainingType,
} from "./intensity-tiers";

describe("Intensity tiers domain logic", () => {
    it("has correct SESSION_INTENSITY_TIERS", () => {
        expect(SESSION_INTENSITY_TIERS.RECOVERY).toBe(1);
        expect(SESSION_INTENSITY_TIERS.SPARRING).toBe(5);
    });

    it("computes maxAllowedTier correctly", () => {
        // No session types blocked -> tier 5
        expect(maxAllowedTier([])).toBe(5);

        // Only SPARRING blocked -> tier 4
        expect(maxAllowedTier(["SPARRING"])).toBe(4);

        // SPARRING and GRAPPLING blocked -> tier 3
        expect(maxAllowedTier(["SPARRING", "GRAPPLING"])).toBe(3);

        // Default manual blocked (all except RECOVERY and PHYSICAL_THERAPY) -> tier 1
        expect(maxAllowedTier(DEFAULT_MANUAL_BLOCKED_SESSION_TYPES)).toBe(1);

        // RECOVERY blocked -> tier 0
        expect(maxAllowedTier(["RECOVERY"])).toBe(0);
        expect(maxAllowedTier(["PHYSICAL_THERAPY"])).toBe(0);
    });

    it("computes blockedTypesForMaxTier correctly", () => {
        expect(blockedTypesForMaxTier(5)).toEqual([]);
        expect(blockedTypesForMaxTier(4)).toEqual(["SPARRING"]);
        expect(blockedTypesForMaxTier(3)).toEqual(["SPARRING", "GRAPPLING"]);
        expect(blockedTypesForMaxTier(2)).toEqual([
            "SHADOW_BOXING",
            "PAD_WORK",
            "HEAVY_BAG",
            "SPARRING",
            "GRAPPLING",
        ]);
        expect(blockedTypesForMaxTier(1)).toEqual([
            "SHADOW_BOXING",
            "PAD_WORK",
            "HEAVY_BAG",
            "SPARRING",
            "GRAPPLING",
            "STRENGTH_CONDITIONING",
        ]);
    });

    it("verifies tierOfTrainingType for all TrainingType variants", () => {
        expect(tierOfTrainingType("recovery_mobility")).toBe(1);
        expect(tierOfTrainingType("strength_conditioning")).toBe(2);
        expect(tierOfTrainingType("shadow_boxing")).toBe(3);
        expect(tierOfTrainingType("pad_work")).toBe(3);
        expect(tierOfTrainingType("heavy_bag")).toBe(3);
        expect(tierOfTrainingType("technical_drilling")).toBe(3);
        expect(tierOfTrainingType("grappling")).toBe(4);
        expect(tierOfTrainingType("sparring")).toBe(5);
    });
});
