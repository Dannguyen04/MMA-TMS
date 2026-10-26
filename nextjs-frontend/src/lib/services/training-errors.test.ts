import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { trainingEligibilityReasons, trainingWriteFailure } from "./training-errors";

const http = (status: number, code: string, details?: unknown, message = "Request failed") => new ApiError({ message, kind: "http", status, code, details });

describe("trainingWriteFailure", () => {
    it("explains the training service's refusals in the coach's terms", () => {
        expect(trainingWriteFailure(http(400, "INVALID_SESSION_STATUS_TRANSITION")).message).toContain("already moved on");
        expect(trainingWriteFailure(http(403, "FORBIDDEN")).message).toContain("no longer on your roster");
        expect(trainingWriteFailure(http(404, "TRAINING_SESSION_NOT_FOUND")).message).toBe("This session no longer exists.");
    });

    it("puts validation issues on their fields and ties a known refusal to its field", () => {
        const invalid = trainingWriteFailure(http(422, "VALIDATION_ERROR", [{ code: "custom", path: ["cancellationReason"], message: "Required" }]), {
            fields: { cancellationReason: "reason" },
        });
        expect(invalid.fieldErrors).toEqual({ reason: "Required." });

        const dates = trainingWriteFailure(http(400, "INVALID_PLAN_DATE_RANGE"), { conflictFields: { INVALID_PLAN_DATE_RANGE: "endDate" } });
        expect(dates.fieldErrors?.endDate).toBe(dates.message);
    });

    it("never claims a change failed when it may have been saved", () => {
        expect(trainingWriteFailure(http(500, "TRAINING_OPERATION_FAILED")).message).toContain("may not have been saved");
    });
});

describe("trainingEligibilityReasons", () => {
    it("reads the reasons from a refused training start, keeping unknown ones as a generic reason", () => {
        const error = http(409, "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED", { reasons: ["REVIEW_REQUEST_PENDING", "SOMETHING_NEW", "CLEARANCE_EXPIRED"] });
        expect(trainingEligibilityReasons(error)).toEqual(["REVIEW_REQUEST_PENDING", "OTHER_MEDICAL_REASON", "CLEARANCE_EXPIRED"]);
    });

    it("ignores other errors", () => {
        expect(trainingEligibilityReasons(http(409, "MEDICAL_RECORD_CONFLICT"))).toBeNull();
        expect(trainingEligibilityReasons(new Error("x"))).toBeNull();
    });
});
