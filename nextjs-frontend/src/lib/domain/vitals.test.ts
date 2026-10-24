import { describe, expect, it } from "vitest";

import { createTranslator } from "@/lib/i18n/translate";
import type { Vitals } from "./types";
import { assessVital, assessVitals, vitalAssessmentMessage, VITAL_REFERENCE_RANGES, WEIGHT_REVIEW_PCT } from "./vitals";

const HEALTHY: Vitals = {
    weightKg: 72,
    restingHeartRate: 52,
    bloodPressureSystolic: 118,
    bloodPressureDiastolic: 74,
    temperatureC: 36.6,
    spo2Pct: 98,
    hydration: "good",
};

describe("assessVital", () => {
    it("treats range bounds as normal and values outside as a check", () => {
        const { min, max } = VITAL_REFERENCE_RANGES.restingHeartRate;
        expect(assessVital("restingHeartRate", min)?.status).toBe("normal");
        expect(assessVital("restingHeartRate", max)?.status).toBe("normal");
        expect(assessVital("restingHeartRate", max + 1)?.status).toBe("check");
        expect(assessVital("restingHeartRate", min - 1)?.status).toBe("check");
        expect(assessVital("temperatureC", 37.6)).toEqual({
            status: "check",
            code: "temperature_range",
            params: { min: "36.0", max: "37.5" },
        });
        expect(assessVital("spo2Pct", 94)?.status).toBe("check");
    });

    it("needs both blood pressure readings in range, with one code", () => {
        expect(assessVital("bloodPressure", { systolic: 139, diastolic: 89 })).toEqual({
            status: "normal",
            code: "blood_pressure_target",
            params: { sysMin: 90, sysMax: 139, diaMin: 55, diaMax: 89 },
        });
        expect(assessVital("bloodPressure", { systolic: 120, diastolic: 92 })?.status).toBe("check");
        expect(assessVital("bloodPressure", { systolic: 85, diastolic: 70 })?.status).toBe("check");
    });

    it("advises fluids when hydration is not good", () => {
        expect(assessVital("hydration", "good")).toEqual({
            status: "normal",
            code: "hydration_good",
        });
        expect(assessVital("hydration", "fair")?.adviceCode).toBe("increase_fluids");
        expect(assessVital("hydration", "poor")?.status).toBe("check");
    });

    it("judges weight against the class limit with a walk-around margin", () => {
        expect(assessVital("weightKg", 70, { weightLimitKg: 70.3 })).toEqual({
            status: "normal",
            code: "weight_within_limit",
            params: { limit: "70.3" },
        });
        expect(assessVital("weightKg", 75, { weightLimitKg: 70 })).toEqual({
            status: "normal",
            code: "weight_above_limit",
            params: { diffKg: "5.0", abovePct: "7.1", limit: "70.0" },
        });
        const overMargin = 70 * (1 + (WEIGHT_REVIEW_PCT + 1) / 100);
        expect(assessVital("weightKg", overMargin, { weightLimitKg: 70 })?.status).toBe("check");
    });

    it("returns null for weight without a class limit", () => {
        expect(assessVital("weightKg", 70)).toBeNull();
        expect(assessVital("weightKg", 70, { weightLimitKg: 0 })).toBeNull();
    });
});

describe("assessVitals", () => {
    it("marks healthy vitals as normal", () => {
        const assessments = assessVitals(HEALTHY, 70.3);
        expect(Object.values(assessments).map((assessment) => assessment?.status)).toEqual(["normal", "normal", "normal", "normal", "normal", "normal"]);
    });

    it("flags every out-of-range reading", () => {
        const assessments = assessVitals({ ...HEALTHY, weightKg: 90, restingHeartRate: 80, temperatureC: 38.2, hydration: "poor" }, 70.3);
        expect(assessments.weightKg?.status).toBe("check");
        expect(assessments.restingHeartRate?.status).toBe("check");
        expect(assessments.temperatureC?.status).toBe("check");
        expect(assessments.hydration?.status).toBe("check");
        expect(assessments.bloodPressure?.status).toBe("normal");
    });
});

describe("vitalAssessmentMessage", () => {
    it("formats vitals in English matching previous strings", () => {
        const enT = createTranslator("en");
        const bp = assessVital("bloodPressure", { systolic: 139, diastolic: 89 })!;
        expect(vitalAssessmentMessage(enT, bp)).toBe("Target 90–139 / 55–89 mmHg");

        const fair = assessVital("hydration", "fair")!;
        expect(vitalAssessmentMessage(enT, fair)).toBe("Increase fluids and recheck before hard sessions");

        const weight = assessVital("weightKg", 75, { weightLimitKg: 70 })!;
        expect(vitalAssessmentMessage(enT, weight)).toBe("5.0 kg (7.1%) above the 70.0 kg limit");
    });

    it("formats vitals in Vietnamese", () => {
        const viT = createTranslator("vi");
        const bp = assessVital("bloodPressure", { systolic: 139, diastolic: 89 })!;
        expect(vitalAssessmentMessage(viT, bp)).toBe("Mục tiêu 90–139 / 55–89 mmHg");

        const fair = assessVital("hydration", "fair")!;
        expect(vitalAssessmentMessage(viT, fair)).toBe("Bổ sung nước và kiểm tra lại trước buổi tập nặng");
    });
});
