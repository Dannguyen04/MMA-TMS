import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { formatShortDate } from "@/lib/format";
import { createTranslator } from "@/lib/i18n/translate";
import { trainingEligibilityReasons, trainingSuspensions, trainingWriteFailure } from "./training-errors";

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

describe("B1. Phần A2 của ticket T-030", () => {
    const tVi = createTranslator("vi");

    it("B1-3: Lỗi 409 TRAINING_SUSPENSION_ACTIVE, details.suspensions = [{ reason:'KO', endsOn:'2026-12-01', requiresClearance:true }] -> đọc được 1 đình chỉ; câu lỗi có lý do và ngày, không phải câu lỗi chung", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "KO", endsOn: "2026-12-01", requiresClearance: true }],
        });

        const suspensions = trainingSuspensions(error);
        expect(suspensions).not.toBeNull();
        expect(suspensions).toHaveLength(1);
        expect(suspensions![0]).toMatchObject({
            reason: "KO",
            endsOn: "2026-12-01",
            requiresClearance: true,
        });

        const expectedDateVi = formatShortDate("2026-12-01", "vi");
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toContain("KO");
        expect(failureVi.message).toContain(expectedDateVi);
        expect(failureVi.message).not.toContain("Request failed");

        const expectedDateEn = formatShortDate("2026-12-01", "en");
        const failureEn = trainingWriteFailure(error);
        expect(failureEn.message).toContain("KO");
        expect(failureEn.message).toContain(expectedDateEn);
        expect(failureEn.message).not.toContain("Request failed");
    });

    it("B1-4: Như B1-3 nhưng phần tử có gradedReturn: { ceiling: 3, fullReturnOn: '2026-12-04' } -> đọc được trần bậc 3 và ngày tập đầy đủ", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [
                {
                    reason: "KO",
                    endsOn: "2026-12-01",
                    requiresClearance: true,
                    gradedReturn: { ceiling: 3, fullReturnOn: "2026-12-04" },
                },
            ],
        });

        const suspensions = trainingSuspensions(error);
        expect(suspensions).not.toBeNull();
        expect(suspensions![0].gradedReturn).toEqual({
            ceiling: 3,
            fullReturnOn: "2026-12-04",
        });

        const expectedDateVi = formatShortDate("2026-12-04", "vi");
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toMatch(/bậc 3|3/);
        expect(failureVi.message).toContain(expectedDateVi);

        const expectedDateEn = formatShortDate("2026-12-04", "en");
        const failureEn = trainingWriteFailure(error);
        expect(failureEn.message).toContain("3");
        expect(failureEn.message).toContain(expectedDateEn);
    });

    it("B1-5: 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED có cả reasons và suspensions -> hiện cả lý do y tế lẫn đình chỉ", () => {
        const error = http(409, "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED", {
            reasons: ["CLEARANCE_EXPIRED"],
            suspensions: [{ reason: "KO", endsOn: "2026-12-01", requiresClearance: true }],
        });

        const reasons = trainingEligibilityReasons(error);
        expect(reasons).toEqual(["CLEARANCE_EXPIRED"]);

        const suspensions = trainingSuspensions(error);
        expect(suspensions).toHaveLength(1);
        expect(suspensions![0].reason).toBe("KO");

        const expectedDateVi = formatShortDate("2026-12-01", "vi");
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toMatch(/y tế|điều kiện/i);
        expect(failureVi.message).toMatch(/đình chỉ|KO/);
        expect(failureVi.message).toContain(expectedDateVi);

        const expectedDateEn = formatShortDate("2026-12-01", "en");
        const failureEn = trainingWriteFailure(error);
        expect(failureEn.message).toMatch(/medically cleared|examination/i);
        expect(failureEn.message).toMatch(/suspended|KO/i);
        expect(failureEn.message).toContain(expectedDateEn);
    });

    it("B1-6: details sai hình dạng (suspensions: 'x', phần tử thiếu endsOn) -> không ném lỗi; bỏ phần tử sai; câu đúng bằng chuỗi vi của khoá training.error.suspensionActiveGeneral", () => {
        const errorString = http(409, "TRAINING_SUSPENSION_ACTIVE", { suspensions: "x" });
        const errorMissingEndsOn = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "KO" }, "not-an-object", null],
        });

        expect(() => trainingSuspensions(errorString)).not.toThrow();
        expect(trainingSuspensions(errorString)).toEqual([]);

        expect(() => trainingSuspensions(errorMissingEndsOn)).not.toThrow();
        expect(trainingSuspensions(errorMissingEndsOn)).toEqual([]);

        const expectedGeneralVi = tVi("training.error.suspensionActiveGeneral");
        expect(() => trainingWriteFailure(errorString, {}, tVi)).not.toThrow();
        const failureString = trainingWriteFailure(errorString, {}, tVi);
        expect(failureString.message).toBe(expectedGeneralVi);

        expect(() => trainingWriteFailure(errorMissingEndsOn, {}, tVi)).not.toThrow();
        const failureMissing = trainingWriteFailure(errorMissingEndsOn, {}, tVi);
        expect(failureMissing.message).toBe(expectedGeneralVi);
    });

    it("B1-7: 409 với reason 'MANDATORY_REST', endsOn '2026-12-01', requiresClearance false -> câu chứa 'Nghỉ bắt buộc' và ngày đúng định dạng formatShortDate('2026-12-01','vi'), KHÔNG chứa 'MANDATORY_REST' hay '2026-12-01'", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "MANDATORY_REST", endsOn: "2026-12-01", requiresClearance: false }],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        const expectedDate = formatShortDate("2026-12-01", "vi");
        expect(failureVi.message).toContain("Nghỉ bắt buộc");
        expect(failureVi.message).toContain(expectedDate);
        expect(failureVi.message).not.toContain("MANDATORY_REST");
        expect(failureVi.message).not.toContain("2026-12-01");
        expect(failureVi.message).not.toContain("chờ xác nhận");
    });

    it("B1-8: phần tử có gradedReturn {ceiling:3, fullReturnOn:'2026-12-04'}, reason 'KO' -> câu chứa 'tập lại theo bậc', 'bậc 3', ngày formatShortDate('2026-12-04','vi'); KHÔNG chứa 'đang bị đình chỉ'", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [
                {
                    reason: "KO",
                    endsOn: "2026-12-01",
                    requiresClearance: true,
                    gradedReturn: { ceiling: 3, fullReturnOn: "2026-12-04" },
                },
            ],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        const expectedDate = formatShortDate("2026-12-04", "vi");
        expect(failureVi.message).toContain("tập lại theo bậc");
        expect(failureVi.message).toContain("bậc 3");
        expect(failureVi.message).toContain(expectedDate);
        expect(failureVi.message).not.toContain("đang bị đình chỉ");
    });

    it("B1-9: reason lạ 'XYZ' -> dùng nhãn 'Khác'", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "XYZ", endsOn: "2026-12-01", requiresClearance: false }],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toContain("Khác");
        expect(failureVi.message).not.toContain("XYZ");
        expect(failureVi.message).not.toContain("chờ xác nhận");
    });

    it("B1-10: requiresClearance true, endsOn '2026-12-01', không gradedReturn -> câu chứa 'chờ xác nhận được tập lại' và ngày formatShortDate('2026-12-01','vi'); kết quả giống nhau bất kể giờ máy", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "KO", endsOn: "2026-12-01", requiresClearance: true }],
        });
        const expectedDate = formatShortDate("2026-12-01", "vi");

        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
            const msgBefore = trainingWriteFailure(error, {}, tVi).message;
            expect(msgBefore).toContain("chờ xác nhận được tập lại");
            expect(msgBefore).toContain(expectedDate);

            vi.setSystemTime(new Date("2026-12-05T10:00:00Z"));
            const msgAfter = trainingWriteFailure(error, {}, tVi).message;
            expect(msgAfter).toContain("chờ xác nhận được tập lại");
            expect(msgAfter).toContain(expectedDate);

            expect(msgBefore).toBe(msgAfter);
        } finally {
            vi.useRealTimers();
        }
    });

    it("B1-11: gradedReturn -> câu không chứa 'hôm nay' (vi) và không chứa 'today' (en)", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [
                {
                    reason: "KO",
                    endsOn: "2026-12-01",
                    requiresClearance: true,
                    gradedReturn: { ceiling: 3, fullReturnOn: "2026-12-04" },
                },
            ],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).not.toContain("hôm nay");

        const failureEn = trainingWriteFailure(error);
        expect(failureEn.message).not.toContain("today");
    });

    it("B1-12: details.suspensions = [KO có gradedReturn {ceiling:3, fullReturnOn:'2026-12-20'} và endsOn '2026-12-15', MANDATORY_REST không gradedReturn endsOn '2026-12-03'] -> câu là của MANDATORY_REST (dù KO có endsOn muộn hơn)", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [
                {
                    reason: "KO",
                    endsOn: "2026-12-15",
                    requiresClearance: true,
                    gradedReturn: { ceiling: 3, fullReturnOn: "2026-12-20" },
                },
                {
                    reason: "MANDATORY_REST",
                    endsOn: "2026-12-03",
                    requiresClearance: false,
                },
            ],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toContain("Nghỉ bắt buộc");
        expect(failureVi.message).not.toContain("KO");
    });

    it("B1-13: details.suspensions = [hợp lệ, thiếu endsOn, 'x'] -> giữ đúng 1 phần tử hợp lệ", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [
                { reason: "KO", endsOn: "2026-12-01", requiresClearance: true },
                { reason: "TKO" },
                "x",
            ],
        });
        const suspensions = trainingSuspensions(error);
        expect(suspensions).toHaveLength(1);
        expect(suspensions![0].reason).toBe("KO");
    });

    it("B1-14: hai đình chỉ không gradedReturn: OTHER endsOn '2026-12-03' và MEDICAL endsOn '2026-12-10' -> câu là của MEDICAL (endsOn muộn hơn)", () => {
        const error = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [
                { reason: "OTHER", endsOn: "2026-12-03", requiresClearance: false },
                { reason: "MEDICAL", endsOn: "2026-12-10", requiresClearance: false },
            ],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toContain("Y tế");
        expect(failureVi.message).not.toContain("Khác");
    });

    it("B1-15: 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED có reasons và cùng danh sách như B1-12 -> phần đình chỉ trong câu là của MANDATORY_REST", () => {
        const error = http(409, "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED", {
            reasons: ["DOCTOR_CLEARANCE_REQUIRED"],
            suspensions: [
                {
                    reason: "KO",
                    endsOn: "2026-12-15",
                    requiresClearance: true,
                    gradedReturn: { ceiling: 3, fullReturnOn: "2026-12-20" },
                },
                {
                    reason: "MANDATORY_REST",
                    endsOn: "2026-12-03",
                    requiresClearance: false,
                },
            ],
        });
        const failureVi = trainingWriteFailure(error, {}, tVi);
        expect(failureVi.message).toContain("Nghỉ bắt buộc");
        expect(failureVi.message).not.toContain("KO");
    });

    it("B1-16: requiresClearance là chuỗi 'true' và số 1 -> parse ra requiresClearance false (câu không chứa 'chờ xác nhận')", () => {
        const errorWithString = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "KO", endsOn: "2026-12-01", requiresClearance: "true" }],
        });
        const suspensionsString = trainingSuspensions(errorWithString);
        expect(suspensionsString![0].requiresClearance).toBe(false);
        const failureString = trainingWriteFailure(errorWithString, {}, tVi);
        expect(failureString.message).not.toContain("chờ xác nhận");

        const errorWithNumber = http(409, "TRAINING_SUSPENSION_ACTIVE", {
            suspensions: [{ reason: "KO", endsOn: "2026-12-01", requiresClearance: 1 }],
        });
        const suspensionsNumber = trainingSuspensions(errorWithNumber);
        expect(suspensionsNumber![0].requiresClearance).toBe(false);
        const failureNumber = trainingWriteFailure(errorWithNumber, {}, tVi);
        expect(failureNumber.message).not.toContain("chờ xác nhận");
    });
});
