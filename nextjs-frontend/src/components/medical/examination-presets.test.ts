import { describe, expect, it } from "vitest";

import { ASSESSMENT_PRESETS, assessmentRowsProblem, markUnmarkedNormal, unmarkedAreas, type AssessmentRowDraft } from "./examination-presets";
import { findingsSummary } from "./findings-summary";

const rows = (): (AssessmentRowDraft & { key: number })[] => [
    { key: 1, area: "Cardiovascular", result: "", note: "" },
    { key: 2, area: "Left knee", result: "abnormal", note: "Mild effusion." },
    { key: 3, area: "Respiratory", result: "inconclusive", note: "" },
    { key: 4, area: "  ", result: "", note: "" },
    { key: 5, area: "Vision", result: "", note: "" },
];

describe("assessment presets", () => {
    it("leaves the SCAT6 out of the baseline areas: it has its own steps", () => {
        expect(ASSESSMENT_PRESETS.baseline.some((area) => /scat/i.test(area))).toBe(false);
    });
});

describe("markUnmarkedNormal", () => {
    it("marks only named rows without a result, and says which", () => {
        const before = rows();
        const { rows: after, filled } = markUnmarkedNormal(before);
        expect(filled).toEqual(["Cardiovascular", "Vision"]);
        expect(after.map((row) => row.result)).toEqual(["normal", "abnormal", "inconclusive", "", "normal"]);
        // Answered and abnormal rows keep their result and note; the unnamed row waits for a name.
        expect(after[1]).toBe(before[1]);
        expect(after[2]).toBe(before[2]);
        expect(after[3]).toBe(before[3]);
        expect(unmarkedAreas(after)).toEqual([]);
    });

    it("does nothing once every named area is marked", () => {
        const { rows: once } = markUnmarkedNormal(rows());
        expect(markUnmarkedNormal(once).filled).toEqual([]);
    });
});

describe("assessmentRowsProblem", () => {
    it("names what's left before the doctor can move on", () => {
        expect(assessmentRowsProblem(rows(), { baseline: true })).toBe("Ghi kết quả cho 2 vùng, đặt tên 1 dòng hoặc xóa đi.");
        expect(assessmentRowsProblem([{ area: "Knee", result: "abnormal", note: " " }], { baseline: false })).toBe("Mô tả dấu hiệu bất thường.");
        expect(assessmentRowsProblem([], { baseline: true })).toContain("ít nhất một vùng được đánh giá");
        expect(assessmentRowsProblem([], { baseline: false })).toBeNull();
    });
});

describe("findingsSummary", () => {
    const vitals = { weightKg: "70.2", restingHeartRate: "58", bloodPressureSystolic: "118", bloodPressureDiastolic: "76", temperatureC: "36.6", spo2Pct: "98", hydration: "good" };

    it("writes only what was entered, without judging it", () => {
        const { rows: marked } = markUnmarkedNormal(rows());
        const text = findingsSummary({ type: "baseline", vitals, assessments: marked, scat6: { status: "ADMINISTERED", reason: "" } });
        expect(text.split("\n")).toEqual([
            "Khám nền.",
            "Sinh hiệu: cân nặng 70.2 kg, mạch nghỉ 58 lần/phút, huyết áp 118/76 mmHg, nhiệt độ 36.6 °C, SpO2 98%, mức nước tốt.",
            "Bình thường: Cardiovascular; Vision.",
            "Bất thường: Left knee (Mild effusion).",
            "Chưa kết luận: Respiratory.",
            "Đã thực hiện SCAT6; dịch vụ y tế tự tính điểm.",
        ]);
        expect(text).not.toMatch(/within|range|score \d|eligible/i);
    });

    it("leaves out blank readings and unmarked rows, and is empty with nothing entered", () => {
        const partial = { ...vitals, bloodPressureDiastolic: "", spo2Pct: " ", hydration: "" };
        const text = findingsSummary({ type: "routine", vitals: partial, assessments: rows(), scat6: null });
        expect(text).toContain("Sinh hiệu: cân nặng 70.2 kg, mạch nghỉ 58 lần/phút, nhiệt độ 36.6 °C.");
        expect(text).not.toContain("Cardiovascular");
        expect(text).not.toContain("SCAT6");
        const blank = { weightKg: "", restingHeartRate: "", bloodPressureSystolic: "", bloodPressureDiastolic: "", temperatureC: "", spo2Pct: "", hydration: "" };
        expect(findingsSummary({ type: "baseline", vitals: blank, assessments: [], scat6: null })).toBe("");
    });

    it("gives the reason when the SCAT6 wasn't administered", () => {
        const text = findingsSummary({ type: "baseline", vitals, assessments: [], scat6: { status: "NOT_ADMINISTERED", reason: "Athlete is 12." } });
        expect(text).toContain("Không thực hiện SCAT6: Athlete is 12.");
    });
});
