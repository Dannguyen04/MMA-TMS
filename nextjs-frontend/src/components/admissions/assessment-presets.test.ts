import { describe, expect, it } from "vitest";

import { ADMISSION_LIMITS } from "@/lib/domain/admissions";
import { CRITERION_PRESETS, appendLine, draftAssessmentSummary, unusedPresets } from "./assessment-presets";

const criterion = (criterionName: string, observation: string, value = "", unit = "") => ({ criterionName, observation, value, unit });

describe("draftAssessmentSummary", () => {
    it("writes one line per observation, with the measured value and unit", () => {
        expect(
            draftAssessmentSummary([
                criterion("Conditioning", "Kept the pace, faded late", "3", " rounds "),
                criterion(" Defence ", "Good  guard\nunder pressure."),
                criterion("Footwork", "Light on his feet", "4"),
            ]),
        ).toBe("Conditioning (3 rounds): Kept the pace, faded late.\nDefence: Good guard under pressure.\nFootwork (4): Light on his feet.");
    });

    it("leaves out criteria without a name or an observation, and is empty when nothing is written", () => {
        expect(draftAssessmentSummary([criterion("Conditioning", "  "), criterion("", "Fast hands")])).toBe("");
        expect(draftAssessmentSummary([])).toBe("");
    });

    it("stops before the summary's length limit instead of cutting a line", () => {
        const long = "x".repeat(60);
        const draft = draftAssessmentSummary([criterion("A", long), criterion("B", long), criterion("C", long)], 140);
        expect(draft.split("\n")).toHaveLength(2);
        expect(draft.length).toBeLessThanOrEqual(140);
        expect(draftAssessmentSummary(Array.from({ length: ADMISSION_LIMITS.criteriaMax }, (_, index) => criterion(`C${index}`, "y".repeat(990)))).length).toBeLessThanOrEqual(ADMISSION_LIMITS.summary);
    });
});

describe("unusedPresets", () => {
    it("hides presets already added, ignoring case and spacing", () => {
        const left = unusedPresets([{ criterionName: " conditioning " }, { criterionName: "Grappling  basics" }]);
        expect(left.map((preset) => preset.criterionName)).not.toContain("Conditioning");
        expect(left.map((preset) => preset.criterionName)).not.toContain("Grappling basics");
        expect(left).toHaveLength(CRITERION_PRESETS.length - 2);
    });

    it("keeps every preset within the service's limits", () => {
        for (const preset of CRITERION_PRESETS) {
            expect(preset.criterionName.length).toBeLessThanOrEqual(ADMISSION_LIMITS.criterionName);
            expect(preset.method.length).toBeLessThanOrEqual(ADMISSION_LIMITS.method);
        }
    });
});

describe("appendLine", () => {
    it("adds a line on its own, once", () => {
        expect(appendLine("", "Ready.")).toBe("Ready.");
        expect(appendLine("Conditioning: Good.  ", "Ready.")).toBe("Conditioning: Good.\nReady.");
        expect(appendLine("Conditioning: Good.\nReady.", "ready.")).toBe("Conditioning: Good.\nReady.");
    });
});
