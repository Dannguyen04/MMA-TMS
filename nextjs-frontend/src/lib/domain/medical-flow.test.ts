import { describe, expect, it } from "vitest";

import { addMonthsToKey, clearanceFromExamination, clearanceTypeSuggestionFor, isRecordedAttempt, suggestClearanceType } from "./medical-flow";

describe("suggestClearanceType", () => {
    it("selects a training clearance for a training baseline without an active injury", () => {
        expect(suggestClearanceType({ scope: "TRAINING", examinationType: "baseline", activeInjuries: 0 })).toMatchObject({ type: "TRAINING", preselect: true });
    });

    it("only suggests a return from injury, for the doctor to confirm, when an injury is active", () => {
        expect(suggestClearanceType({ scope: "TRAINING", examinationType: "baseline", activeInjuries: 1 })).toMatchObject({ type: "RETURN_FROM_INJURY", preselect: false });
        expect(suggestClearanceType({ scope: "TRAINING", examinationType: "routine", activeInjuries: 2 }).reason).toContain("2 active injuries");
    });

    it("suggests a return from injury after an injury-related examination, and leaves other examinations to the doctor", () => {
        expect(suggestClearanceType({ scope: "TRAINING", examinationType: "return_to_play", activeInjuries: 0 })).toMatchObject({ type: "RETURN_FROM_INJURY", preselect: false });
        expect(suggestClearanceType({ scope: "TRAINING", examinationType: "routine", activeInjuries: 0 })).toMatchObject({ type: "TRAINING", preselect: false });
        expect(suggestClearanceType({ scope: "TRAINING", examinationType: null, activeInjuries: 0 })).toMatchObject({ preselect: false });
    });

    it("keeps a competition examination to a competition clearance", () => {
        const suggestion = suggestClearanceType({ scope: "COMPETITION", examinationType: "pre_fight", activeInjuries: 1 });
        expect(suggestion).toMatchObject({ type: "COMPETITION", preselect: true });
        expect(clearanceTypeSuggestionFor("COMPETITION", suggestion)).toBe(suggestion);
        expect(clearanceTypeSuggestionFor("COMPETITION", { type: "TRAINING", preselect: true, reason: "" })).toBeNull();
    });
});

describe("isRecordedAttempt", () => {
    const attempt = { decision: "ELIGIBLE" as const, examinedAt: "2026-09-01T02:00:00.000Z", reason: "Healthy baseline. " };

    it("treats the scope's current examination as the attempt only when time, decision and reasoning match", () => {
        expect(isRecordedAttempt({ decision: "ELIGIBLE", examinedAt: "2026-09-01T02:00:00Z", reason: "Healthy baseline." }, attempt)).toBe(true);
        expect(isRecordedAttempt({ decision: "ELIGIBLE", examinedAt: "2026-09-01T02:01:00.000Z", reason: "Healthy baseline." }, attempt)).toBe(false);
        expect(isRecordedAttempt({ decision: "ELIGIBLE_WITH_RESTRICTIONS", examinedAt: attempt.examinedAt, reason: "Healthy baseline." }, attempt)).toBe(false);
        expect(isRecordedAttempt({ decision: "ELIGIBLE", examinedAt: attempt.examinedAt, reason: "Another doctor's note." }, attempt)).toBe(false);
        expect(isRecordedAttempt(null, attempt)).toBe(false);
    });
});

describe("clearanceFromExamination", () => {
    it("finds a clearance of the same type from the same examination that isn't revoked", () => {
        const clearances = [
            { id: "c-1", examinationId: "exam-1", clearanceType: "TRAINING" as const, status: "revoked" },
            { id: "c-2", examinationId: "exam-1", clearanceType: "RETURN_FROM_INJURY" as const, status: "active" },
            { id: "c-3", examinationId: "exam-1", clearanceType: "TRAINING" as const, status: "expired" },
        ];
        expect(clearanceFromExamination(clearances, "exam-1", "TRAINING")?.id).toBe("c-3");
        expect(clearanceFromExamination(clearances, "exam-2", "TRAINING")).toBeNull();
    });
});

describe("addMonthsToKey", () => {
    it("moves by calendar months and keeps the day, or the month's last day", () => {
        expect(addMonthsToKey("2026-10-11", 3)).toBe("2027-01-11");
        expect(addMonthsToKey("2026-08-31", 6)).toBe("2027-02-28");
        expect(addMonthsToKey("2027-08-31", 6)).toBe("2028-02-29");
        expect(addMonthsToKey("2026-10-11", 12)).toBe("2027-10-11");
        expect(addMonthsToKey("not a date", 3)).toBe("not a date");
    });
});
