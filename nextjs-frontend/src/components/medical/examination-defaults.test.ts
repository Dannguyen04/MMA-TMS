import { describe, expect, it } from "vitest";

import { defaultFollowUp } from "./examination-details-fields";
import { defaultExaminationType, fillBlankVitals, vitalsDraftFrom } from "./examination-presets";

const VITALS = { weightKg: 79.4, restingHeartRate: 58, bloodPressureSystolic: 125, bloodPressureDiastolic: 80, temperatureC: 36.6, spo2Pct: 98, hydration: "good" as const };
const BLANK = { weightKg: "", restingHeartRate: "", bloodPressureSystolic: "", bloodPressureDiastolic: "", temperatureC: "", spo2Pct: "", hydration: "" };

describe("examination form defaults", () => {
    it("starts a never-examined fighter on a baseline and everyone else on a routine check", () => {
        expect(defaultExaminationType(false)).toBe("baseline");
        expect(defaultExaminationType(true)).toBe("routine");
    });

    it("sets the follow-up by examination type, and none for a pre-fight check", () => {
        expect(defaultFollowUp("routine", "2026-11-09")).toBe("2026-12-07");
        expect(defaultFollowUp("post_injury", "2026-11-09")).toBe("2026-11-16");
        expect(defaultFollowUp("pre_fight", "2026-11-09")).toBe("");
        expect(defaultFollowUp("", "2026-11-09")).toBe("");
    });

    it("never prefills vitals: previous readings fill only blank fields, and only when asked", () => {
        const previous = vitalsDraftFrom(VITALS)!;
        expect(vitalsDraftFrom(null)).toBeNull();
        const { next, filled } = fillBlankVitals({ ...BLANK, weightKg: "80.1" }, previous);
        expect(next.weightKg).toBe("80.1");
        expect(next.restingHeartRate).toBe("58");
        expect(next.hydration).toBe("good");
        expect(filled).not.toContain("weightKg");
        expect(filled).toHaveLength(6);
    });
});
