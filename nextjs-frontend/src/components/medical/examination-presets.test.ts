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
        expect(assessmentRowsProblem(rows(), { baseline: true })).toBe("Mark a result for 2 areas, name 1 row or remove it.");
        expect(assessmentRowsProblem([{ area: "Knee", result: "abnormal", note: " " }], { baseline: false })).toBe("Describe the abnormal finding.");
        expect(assessmentRowsProblem([], { baseline: true })).toContain("at least one assessed area");
        expect(assessmentRowsProblem([], { baseline: false })).toBeNull();
    });
});

describe("findingsSummary", () => {
    const vitals = { weightKg: "70.2", restingHeartRate: "58", bloodPressureSystolic: "118", bloodPressureDiastolic: "76", temperatureC: "36.6", spo2Pct: "98", hydration: "good" };

    it("writes only what was entered, without judging it", () => {
        const { rows: marked } = markUnmarkedNormal(rows());
        const text = findingsSummary({ type: "baseline", vitals, assessments: marked, scat6: { status: "ADMINISTERED", reason: "" } });
        expect(text.split("\n")).toEqual([
            "Baseline physical.",
            "Vitals: weight 70.2 kg, resting heart rate 58 bpm, blood pressure 118/76 mmHg, temperature 36.6 °C, SpO₂ 98%, hydration good.",
            "Normal: Cardiovascular; Vision.",
            "Abnormal: Left knee (Mild effusion).",
            "Inconclusive: Respiratory.",
            "SCAT6 administered; the medical service calculates its scores.",
        ]);
        expect(text).not.toMatch(/within|range|score \d|eligible/i);
    });

    it("leaves out blank readings and unmarked rows, and is empty with nothing entered", () => {
        const partial = { ...vitals, bloodPressureDiastolic: "", spo2Pct: " ", hydration: "" };
        const text = findingsSummary({ type: "routine", vitals: partial, assessments: rows(), scat6: null });
        expect(text).toContain("Vitals: weight 70.2 kg, resting heart rate 58 bpm, temperature 36.6 °C.");
        expect(text).not.toContain("Cardiovascular");
        expect(text).not.toContain("SCAT6");
        const blank = { weightKg: "", restingHeartRate: "", bloodPressureSystolic: "", bloodPressureDiastolic: "", temperatureC: "", spo2Pct: "", hydration: "" };
        expect(findingsSummary({ type: "baseline", vitals: blank, assessments: [], scat6: null })).toBe("");
    });

    it("gives the reason when the SCAT6 wasn't administered", () => {
        const text = findingsSummary({ type: "baseline", vitals, assessments: [], scat6: { status: "NOT_ADMINISTERED", reason: "Athlete is 12." } });
        expect(text).toContain("SCAT6 not administered: Athlete is 12.");
    });
});
