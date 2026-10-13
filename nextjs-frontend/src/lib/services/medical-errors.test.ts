import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { isUnconfirmedWrite, MAYBE_NOT_SAVED, medicalWriteFailure } from "./medical-errors";

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

    it("marks only the failures that may have been saved as unconfirmed, so the form checks the record first", () => {
        const unconfirmed = [
            http(503, "SERVICE_UNAVAILABLE"),
            new ApiError({ message: "slow", kind: "timeout", code: "API_TIMEOUT" }),
            new ApiError({ message: "down", kind: "network", code: "API_UNREACHABLE" }),
            new ApiError({ message: "odd", kind: "invalid_response", status: 201, code: "INVALID_API_RESPONSE" }),
        ];
        for (const error of unconfirmed) {
            expect(isUnconfirmedWrite(error)).toBe(true);
            expect(medicalWriteFailure(error).unconfirmed).toBe(true);
        }
        for (const error of [http(422, "VALIDATION_ERROR"), http(409, "MEDICAL_RECORD_CONFLICT"), new ApiError({ message: "expired", kind: "unauthorized", status: 401 }), new TypeError("bug")]) {
            expect(isUnconfirmedWrite(error)).toBe(false);
        }
        expect(medicalWriteFailure(http(409, "MEDICAL_RECORD_CONFLICT")).unconfirmed).toBeUndefined();
    });

    it("rethrows anything that isn't an API error", () => {
        expect(() => medicalWriteFailure(new TypeError("bug"))).toThrow("bug");
    });
});
