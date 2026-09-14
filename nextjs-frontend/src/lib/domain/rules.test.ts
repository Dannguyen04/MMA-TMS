import { describe, expect, it } from "vitest";

import {
    checkTrainingAgainstClearance,
    clearanceState,
    confidenceBand,
    currentClearance,
    goalProgressPct,
    isLowConfidence,
    type PlannedTraining,
} from "./rules";
import type { MedicalClearance, TrainingRestriction } from "./types";

/** 12:00 in Ho Chi Minh City. */
const NOW = "2026-09-14T05:00:00.000Z";

function clearance(overrides: Partial<MedicalClearance> = {}): MedicalClearance {
    return {
        id: "cl-test",
        fighterId: "f-test",
        doctorId: "d-test",
        level: "full",
        status: "active",
        issuedAt: "2026-08-01T04:00:00.000Z",
        validUntil: "2026-12-01T04:00:00.000Z",
        reason: "Routine examination",
        restrictions: [],
        examinationId: null,
        revokedAt: null,
        revokedReason: null,
        ...overrides,
    };
}

function restriction(overrides: Partial<TrainingRestriction> = {}): TrainingRestriction {
    return {
        id: "rs-test",
        label: "Protect the left hamstring",
        blockedTrainingTypes: [],
        blockedTechniques: [],
        blockedRegions: [],
        maxRpe: null,
        ...overrides,
    };
}

function planned(overrides: Partial<PlannedTraining> = {}): PlannedTraining {
    return { type: "pad_work", targetRpe: 6, techniques: ["jab", "cross"], loadsRegions: ["left_hand", "right_hand"], ...overrides };
}

describe("confidenceBand", () => {
    it("bands confidence at the low and high thresholds", () => {
        expect(confidenceBand(0.2)).toBe("low");
        expect(confidenceBand(0.599)).toBe("low");
        expect(confidenceBand(0.6)).toBe("medium");
        expect(confidenceBand(0.799)).toBe("medium");
        expect(confidenceBand(0.8)).toBe("high");
        expect(confidenceBand(1)).toBe("high");
    });

    it("respects a custom low-confidence threshold", () => {
        expect(confidenceBand(0.65, 0.7)).toBe("low");
        expect(confidenceBand(0.55, 0.5)).toBe("medium");
        expect(isLowConfidence(0.65, 0.7)).toBe(true);
        expect(isLowConfidence(0.6)).toBe(false);
    });
});

describe("goalProgressPct", () => {
    it("measures progress from baseline to target when higher is better", () => {
        expect(goalProgressPct({ baseline: 50, target: 70, current: 50 })).toBe(0);
        expect(goalProgressPct({ baseline: 50, target: 70, current: 60 })).toBe(50);
        expect(goalProgressPct({ baseline: 50, target: 70, current: 70 })).toBe(100);
        expect(goalProgressPct({ baseline: 50, target: 70, current: 63 })).toBe(65);
    });

    it("works for lower-is-better goals where the baseline is above the target", () => {
        expect(goalProgressPct({ baseline: 600, target: 400, current: 600 })).toBe(0);
        expect(goalProgressPct({ baseline: 600, target: 400, current: 500 })).toBe(50);
        expect(goalProgressPct({ baseline: 600, target: 400, current: 400 })).toBe(100);
    });

    it("clamps to 0–100 when the value moves past either end", () => {
        expect(goalProgressPct({ baseline: 50, target: 70, current: 80 })).toBe(100);
        expect(goalProgressPct({ baseline: 50, target: 70, current: 45 })).toBe(0);
        expect(goalProgressPct({ baseline: 600, target: 400, current: 350 })).toBe(100);
        expect(goalProgressPct({ baseline: 600, target: 400, current: 650 })).toBe(0);
    });

    it("treats a goal whose baseline already equals the target as complete", () => {
        expect(goalProgressPct({ baseline: 5, target: 5, current: 5 })).toBe(100);
    });
});

describe("clearanceState", () => {
    it("is none without a clearance", () => {
        expect(clearanceState(null, NOW)).toBe("none");
    });

    it("returns the level of an active clearance that is still valid", () => {
        expect(clearanceState(clearance(), NOW)).toBe("full");
        expect(clearanceState(clearance({ level: "restricted" }), NOW)).toBe("restricted");
        expect(clearanceState(clearance({ level: "not_cleared", validUntil: null }), NOW)).toBe("not_cleared");
    });

    it("stays valid through the last day and is open-ended without validUntil", () => {
        expect(clearanceState(clearance({ validUntil: "2026-09-14T16:59:00.000Z" }), NOW)).toBe("full");
        expect(clearanceState(clearance({ validUntil: null }), NOW)).toBe("full");
    });

    it("is expired once validUntil has passed or the status says so", () => {
        expect(clearanceState(clearance({ validUntil: "2026-09-13T04:00:00.000Z" }), NOW)).toBe("expired");
        expect(clearanceState(clearance({ status: "expired" }), NOW)).toBe("expired");
    });

    it("treats a revoked clearance as not cleared", () => {
        expect(clearanceState(clearance({ status: "revoked", revokedAt: "2026-09-12T04:00:00.000Z" }), NOW)).toBe("not_cleared");
    });
});

describe("currentClearance", () => {
    it("returns the newest record that hasn't been superseded, including a revocation", () => {
        const older = clearance({ id: "cl-old", status: "superseded", issuedAt: "2026-06-01T04:00:00.000Z" });
        const revoked = clearance({ id: "cl-revoked", status: "revoked", issuedAt: "2026-08-01T04:00:00.000Z" });
        expect(currentClearance([older, revoked], "f-test")?.id).toBe("cl-revoked");
    });

    it("prefers a clearance issued after a revocation and ignores other fighters", () => {
        const revoked = clearance({ id: "cl-revoked", status: "revoked", issuedAt: "2026-08-01T04:00:00.000Z" });
        const renewed = clearance({ id: "cl-renewed", issuedAt: "2026-09-01T04:00:00.000Z" });
        const otherFighter = clearance({ id: "cl-other", fighterId: "f-other", issuedAt: "2026-09-10T04:00:00.000Z" });
        expect(currentClearance([revoked, renewed, otherFighter], "f-test")?.id).toBe("cl-renewed");
        expect(currentClearance([otherFighter], "f-test")).toBeNull();
    });
});

describe("checkTrainingAgainstClearance", () => {
    it("warns when there is no clearance on file", () => {
        const conflicts = checkTrainingAgainstClearance(planned(), null, NOW);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].severity).toBe("warn");
    });

    it("blocks every session for a fighter who is not cleared", () => {
        const conflicts = checkTrainingAgainstClearance(planned({ type: "recovery_mobility", targetRpe: 2 }), clearance({ level: "not_cleared", validUntil: null }), NOW);
        expect(conflicts).toEqual([expect.objectContaining({ severity: "block" })]);
    });

    it("blocks training on an expired clearance", () => {
        const conflicts = checkTrainingAgainstClearance(planned(), clearance({ validUntil: "2026-09-10T04:00:00.000Z" }), NOW);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].severity).toBe("block");
        expect(conflicts[0].message).toContain("expired");
    });

    it("allows anything under a full clearance", () => {
        expect(checkTrainingAgainstClearance(planned({ type: "sparring", targetRpe: 10 }), clearance(), NOW)).toEqual([]);
    });

    it("blocks a restricted training type", () => {
        const cl = clearance({ level: "restricted", restrictions: [restriction({ blockedTrainingTypes: ["sparring"] })] });
        expect(checkTrainingAgainstClearance(planned({ type: "sparring" }), cl, NOW)).toEqual([expect.objectContaining({ severity: "block" })]);
        expect(checkTrainingAgainstClearance(planned({ type: "pad_work" }), cl, NOW)).toEqual([]);
    });

    it("blocks a target RPE above the cleared maximum but allows the maximum itself", () => {
        const cl = clearance({ level: "restricted", restrictions: [restriction({ maxRpe: 7 })] });
        const over = checkTrainingAgainstClearance(planned({ targetRpe: 8 }), cl, NOW);
        expect(over).toEqual([expect.objectContaining({ severity: "block" })]);
        expect(over[0].message).toContain("RPE 7");
        expect(checkTrainingAgainstClearance(planned({ targetRpe: 7 }), cl, NOW)).toEqual([]);
    });

    it("warns about restricted techniques and protected regions", () => {
        const cl = clearance({
            level: "restricted",
            restrictions: [restriction({ blockedTechniques: ["kick"], blockedRegions: ["left_hamstring"] })],
        });
        const conflicts = checkTrainingAgainstClearance(
            planned({ type: "technical_drilling", techniques: ["jab", "kick"], loadsRegions: ["left_hamstring", "left_hip"] }),
            cl,
            NOW,
        );
        expect(conflicts.map((c) => c.severity)).toEqual(["warn", "warn"]);
        expect(conflicts[0].message).toContain("Kick");
        expect(conflicts[1].message).toContain("Left hamstring");
    });

    it("reports every restriction that applies", () => {
        const cl = clearance({
            level: "restricted",
            restrictions: [
                restriction({ id: "rs-1", blockedTrainingTypes: ["heavy_bag"], maxRpe: 8 }),
                restriction({ id: "rs-2", label: "Protect the right hand", blockedRegions: ["right_hand"] }),
            ],
        });
        const conflicts = checkTrainingAgainstClearance(planned({ type: "heavy_bag", targetRpe: 9 }), cl, NOW);
        expect(conflicts.map((c) => c.severity)).toEqual(["block", "block", "warn"]);
    });
});
