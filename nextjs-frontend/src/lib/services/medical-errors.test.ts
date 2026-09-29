import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { MAYBE_NOT_SAVED, medicalWriteFailure, trainingEligibilityReasons } from "./medical-errors";

const http = (status: number, code: string, details?: unknown, message = "Request failed") => new ApiError({ message, kind: "http", status, code, details });

describe("medicalWriteFailure", () => {
    it("puts each validation issue on its form field", () => {
        const error = http(422, "VALIDATION_ERROR", [
            { code: "custom", path: ["restrictions", "excludedJoints"], message: "too small" },
            { code: "custom", path: ["milestones", 1, "title"], message: "Required" },
            { code: "custom", path: ["examinedAt"], message: "Must not be in the future" },
            { code: "custom", path: [], message: "At least one restriction must be provided" },
        ]);
        const failure = medicalWriteFailure(error, { fields: { restrictions: "restrictions", "restrictions.excludedJoints": "excludedJoints", milestones: "milestones", examinedAt: "examinedAt" } });
        expect(failure.fieldErrors).toEqual({ excludedJoints: "Too small.", "milestones.1.title": "Required.", examinedAt: "Must not be in the future." });
        expect(failure.message).toContain("At least one restriction must be provided.");
    });

    it("explains a lost assignment, a missing record and a known conflict", () => {
        expect(medicalWriteFailure(http(403, "FORBIDDEN")).message).toContain("no longer assigned");
        expect(medicalWriteFailure(http(404, "INJURY_NOT_FOUND")).message).toBe("This injury record no longer exists, or belongs to another fighter.");
        expect(medicalWriteFailure(http(409, "INVALID_INJURY_STATUS_TRANSITION")).message).toContain("resolved injury stays resolved");
    });

    it("can tie a conflict to a field", () => {
        const failure = medicalWriteFailure(http(409, "RECOVERY_PLAN_DATE_CONFLICT"), { conflictFields: { RECOVERY_PLAN_DATE_CONFLICT: "estimatedEndDate" } });
        expect(failure.fieldErrors?.estimatedEndDate).toBe(failure.message);
    });

    it("never claims a change failed when it may have been saved", () => {
        expect(medicalWriteFailure(http(500, "MEDICAL_OPERATION_FAILED")).message).toBe(MAYBE_NOT_SAVED);
        expect(medicalWriteFailure(new ApiError({ message: "slow", kind: "timeout", code: "API_TIMEOUT" })).message).toBe(MAYBE_NOT_SAVED);
        expect(medicalWriteFailure(new ApiError({ message: "odd", kind: "invalid_response", status: 201, code: "INVALID_API_RESPONSE" })).message).toContain("probably saved");
    });

    it("rethrows anything that isn't an API error", () => {
        expect(() => medicalWriteFailure(new TypeError("bug"))).toThrow("bug");
    });
});

describe("trainingEligibilityReasons", () => {
    it("reads the reasons from a refused training start", () => {
        const error = http(409, "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED", { reasons: ["REVIEW_REQUEST_PENDING", "SOMETHING_NEW", "CLEARANCE_EXPIRED"] });
        expect(trainingEligibilityReasons(error)).toEqual(["REVIEW_REQUEST_PENDING", "CLEARANCE_EXPIRED"]);
    });

    it("ignores other errors", () => {
        expect(trainingEligibilityReasons(http(409, "MEDICAL_RECORD_CONFLICT"))).toBeNull();
        expect(trainingEligibilityReasons(new Error("x"))).toBeNull();
    });
});
