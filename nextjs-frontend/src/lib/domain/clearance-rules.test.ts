import { describe, expect, it } from "vitest";

import { RESTRICTION_PRESETS, maxRpeRestriction, protectRegionRestriction } from "@/components/medical/restriction-presets";
import { mockMedicalClearances } from "@/lib/mocks/medical";

import { restrictionEffects, restrictionSeverity } from "./clearance-rules";
import { TRAINING_TYPE_LABELS } from "./labels";
import { checkTrainingAgainstClearance, type ClearanceConflict, type PlannedTraining } from "./rules";
import type { MedicalClearance, TrainingRestriction, TrainingType } from "./types";

const NOW = "2026-09-14T05:00:00.000Z";
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];

const presetRestrictions: TrainingRestriction[] = [
    ...RESTRICTION_PRESETS.map(({ id, restriction }) => ({ ...restriction, id })),
    { ...maxRpeRestriction(6), id: "preset-max-rpe" },
    { ...protectRegionRestriction("left_knee"), id: "preset-protect-region" },
];
const seededRestrictions = mockMedicalClearances.flatMap((clearance) => clearance.restrictions);

/** An open-ended restricted clearance carrying only this restriction. */
function clearanceWith(restriction: TrainingRestriction): MedicalClearance {
    return {
        id: "cl-test",
        fighterId: "f-test",
        doctorId: "d-test",
        level: "restricted",
        status: "active",
        issuedAt: "2026-08-01T04:00:00.000Z",
        validUntil: null,
        reason: "Test",
        restrictions: [restriction],
        examinationId: null,
        revokedAt: null,
        revokedReason: null,
    };
}

function conflicts(restriction: TrainingRestriction, planned: PlannedTraining): ClearanceConflict[] {
    return checkTrainingAgainstClearance(planned, clearanceWith(restriction), NOW);
}

const blocks = (list: ClearanceConflict[]) => list.some((conflict) => conflict.severity === "block");

function allowedType(restriction: TrainingRestriction): TrainingType {
    const type = TRAINING_TYPES.find((candidate) => !restriction.blockedTrainingTypes.includes(candidate));
    if (!type) throw new Error(`${restriction.id} blocks every training type`);
    return type;
}

/** A planned session that touches everything the restriction names, while staying within its RPE cap. */
function matchingSession(restriction: TrainingRestriction, type: TrainingType): PlannedTraining {
    return {
        type,
        targetRpe: restriction.maxRpe ?? 1,
        techniques: restriction.blockedTechniques,
        loadsRegions: restriction.blockedRegions,
    };
}

describe.each([
    ["restriction presets", presetRestrictions],
    ["seeded clearances", seededRestrictions],
])("restrictionSeverity agrees with the scheduler for %s", (_source, restrictions) => {
    it("has restrictions to check", () => {
        expect(restrictions.length).toBeGreaterThan(0);
    });

    it.each(restrictions.map((restriction) => [restriction.label, restriction] as const))("%s", (_label, restriction) => {
        const severity = restrictionSeverity(restriction);
        const effects = restrictionEffects(restriction);
        const onAllowedType = conflicts(restriction, matchingSession(restriction, allowedType(restriction)));

        // Techniques and regions never block on their own.
        expect(blocks(onAllowedType)).toBe(false);
        if (effects.avoidTechniques.length > 0 || effects.protectRegions.length > 0) {
            expect(onAllowedType.length).toBeGreaterThan(0);
        }

        if (severity === "block") {
            expect(effects.blocksTypes.length).toBeGreaterThan(0);
            expect(blocks(conflicts(restriction, matchingSession(restriction, effects.blocksTypes[0])))).toBe(true);
        }
        if (severity === "limit" && effects.maxRpe !== null) {
            const overCap = { ...matchingSession(restriction, allowedType(restriction)), targetRpe: effects.maxRpe + 1 };
            expect(blocks(conflicts(restriction, overCap))).toBe(true);
        }
        if (severity === "warn") {
            expect(effects.blocksTypes).toEqual([]);
            expect(effects.maxRpe).toBeNull();
            expect(blocks(conflicts(restriction, { ...matchingSession(restriction, allowedType(restriction)), targetRpe: 10 }))).toBe(false);
        }
    });
});

describe("restrictionSeverity", () => {
    it("ranks blocked training types above an RPE cap", () => {
        const restriction: TrainingRestriction = {
            id: "rst",
            label: "No sparring, max RPE 6",
            blockedTrainingTypes: ["sparring"],
            blockedTechniques: ["kick"],
            blockedRegions: [],
            maxRpe: 6,
        };
        expect(restrictionSeverity(restriction)).toBe("block");
        expect(restrictionSeverity({ ...restriction, blockedTrainingTypes: [] })).toBe("limit");
        expect(restrictionSeverity({ ...restriction, blockedTrainingTypes: [], maxRpe: null })).toBe("warn");
    });
});
