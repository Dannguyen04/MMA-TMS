import { describe, expect, it } from "vitest";

import { examProgress, sectorPath, type ExamProgressInput } from "./exam-progress";

const EMPTY_VITALS = { weightKg: "", restingHeartRate: "", bloodPressureSystolic: "", bloodPressureDiastolic: "", temperatureC: "", spo2Pct: "", hydration: "" };
const base: ExamProgressInput = { date: "2026-11-09T20:06", type: "routine", vitals: EMPTY_VITALS, rows: [], outcome: "", summary: "", recommendations: "" };
const byKey = (input: ExamProgressInput) => Object.fromEntries(examProgress(input).map((step) => [step.key, step]));

describe("examination form progress", () => {
    it("counts each part from the form's own values", () => {
        const steps = byKey({
            ...base,
            vitals: { ...EMPTY_VITALS, weightKg: "80.1", restingHeartRate: "58" },
            rows: [
                { area: "Tim mạch", result: "normal", note: "" },
                { area: "Hô hấp", result: "", note: "" },
            ],
            outcome: "fit",
        });
        expect(steps.visit).toMatchObject({ state: "done", pct: 1 });
        expect(steps.vitals).toMatchObject({ state: "part", text: "2/7" });
        expect(steps.assess).toMatchObject({ state: "part", pct: 0.5, text: "1/2" });
        expect(steps.decide).toMatchObject({ state: "part", text: "Thiếu tóm tắt" });
    });

    it("flags an abnormal finding without a description", () => {
        const steps = byKey({ ...base, rows: [{ area: "Hô hấp", result: "abnormal", note: "" }] });
        expect(steps.assess).toMatchObject({ state: "need", text: "1 cần mô tả", pct: 0.5 });
    });

    it("marks every part done once the form is complete", () => {
        const vitals = Object.fromEntries(Object.keys(EMPTY_VITALS).map((key) => [key, "1"]));
        const steps = examProgress({ ...base, vitals, rows: [{ area: "Tim mạch", result: "normal", note: "" }], outcome: "fit", summary: "Ổn", recommendations: "Tập tiếp" });
        expect(steps.map((step) => step.state)).toEqual(["done", "done", "done", "done"]);
    });
});

describe("progress circle", () => {
    it("starts at twelve o'clock and fills counter-clockwise, towards the left first", () => {
        const end = sectorPath(0.25).split(" ").slice(-2).join(" ");
        const [x, y] = end.replace("Z", "").split(" ").map(Number);
        expect(x).toBeCloseTo(0.75); // nine o'clock
        expect(y).toBeCloseTo(10);
        expect(sectorPath(0)).toBe("");
        expect(sectorPath(1)).toContain("A9.25 9.25 0 1 0");
    });
});
