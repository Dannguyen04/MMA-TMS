import { describe, expect, it } from "vitest";

import type { Vitals } from "./types";
import { assessVital, assessVitals, VITAL_REFERENCE_RANGES, WEIGHT_REVIEW_PCT } from "./vitals";

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
        expect(assessVital("temperatureC", 37.6)).toEqual({ status: "check", reference: "Normal 36.0–37.5 °C" });
        expect(assessVital("spo2Pct", 94)?.status).toBe("check");
    });

    it("needs both blood pressure readings in range, with one wording", () => {
        expect(assessVital("bloodPressure", { systolic: 139, diastolic: 89 })).toEqual({ status: "normal", reference: "Target 90–139 / 55–89 mmHg" });
        expect(assessVital("bloodPressure", { systolic: 120, diastolic: 92 })?.status).toBe("check");
        expect(assessVital("bloodPressure", { systolic: 85, diastolic: 70 })?.status).toBe("check");
    });

    it("advises fluids when hydration is not good", () => {
        expect(assessVital("hydration", "good")).toEqual({ status: "normal", reference: "Well hydrated" });
        expect(assessVital("hydration", "fair")?.advice).toBe("Increase fluids and recheck before hard sessions");
        expect(assessVital("hydration", "poor")?.status).toBe("check");
    });

    it("judges weight against the class limit with a walk-around margin", () => {
        expect(assessVital("weightKg", 70, { weightLimitKg: 70.3 })).toEqual({ status: "normal", reference: "Within the 70.3 kg class limit" });
        expect(assessVital("weightKg", 75, { weightLimitKg: 70 })).toEqual({ status: "normal", reference: "5.0 kg (7.1%) above the 70.0 kg limit" });
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
