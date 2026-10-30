import { describe, expect, it } from "vitest";

import { createTranslator } from "@/lib/i18n/translate";
import { describeJobFailure } from "./job-failure";
import { durationProblem, formatList } from "./upload-wizard-state";
import { analysisSummary, eventDetail, possibleStrike, reviewCountParts, storedLabel } from "./video-copy";

const en = createTranslator("en");
const vi = createTranslator("vi");

/** The summaries `mapWorkerResult` writes, verbatim. */
const STRIKES = "The model detected 107 strike candidates (21.4 per minute), including 9 combinations. ";
const SUMMARIES = [
    `${STRIKES}Evidence quality or calibrated detection confidence is insufficient; a coach must verify the events before using technique findings.`,
    `${STRIKES}12 detections fell below 60% confidence and are marked for coach review.`,
    `${STRIKES}Detections with confidence below 60% are marked for coach review.`,
    "Footage available for review. 4 footage windows; these are not repetitions or verified strikes. A professional must interpret the video. No technique score or clinical conclusion is generated.",
];

describe("video copy", () => {
    it("rebuilds every pipeline summary unchanged in English and in Vietnamese otherwise", () => {
        for (const summary of SUMMARIES) {
            expect(analysisSummary(en, summary)).toBe(summary);
            const translated = analysisSummary(vi, summary);
            expect(translated).not.toBe(summary);
            expect(translated).not.toMatch(/screens\.video/);
        }
        expect(analysisSummary(vi, SUMMARIES[1])).toContain("107");
        expect(analysisSummary(vi, SUMMARIES[1])).toContain("12");
    });

    it("shows summaries it does not recognise as written", () => {
        const demo = "Mô hình phát hiện 40 đòn (12/phút).";
        expect(analysisSummary(vi, demo)).toBe(demo);
        expect(analysisSummary(vi, "The model detected 3 strike candidates (1 per minute), including 0 combinations. Something new.")).toContain("Something new.");
    });

    it("translates the pipeline's movement details and keeps English verbatim", () => {
        for (const detail of ["Right hand dropped below the chin after the jab", "Left hand dropped below the chin after the punch (unclassified)", "Fighter not detected in frame"]) {
            expect(eventDetail(en, detail)).toBe(detail);
            expect(eventDetail(vi, detail)).not.toBe(detail);
        }
        expect(eventDetail(vi, "Bước vào cự ly")).toBe("Bước vào cự ly");
    });

    it("keeps the English wording of shared labels and messages", () => {
        expect(possibleStrike(en, "punch")).toBe("Possible punch (unclassified)");
        expect(reviewCountParts(en, { unreviewedFindings: 1, lowConfidenceDetections: 5 })).toEqual(["1 unreviewed finding", "5 low-confidence detections"]);
        expect(storedLabel(vi, "Hook")).toBe(vi("technique.hook"));
        expect(storedLabel(vi, "Feint")).toBe("Feint");
        expect(describeJobFailure("WORKER_TIMEOUT").title).toBe("Processing took too long");
        expect(describeJobFailure("SOMETHING_ELSE").title).toBe("AI analysis didn't finish");
        expect(describeJobFailure("WORKER_TIMEOUT", "vi").title).not.toBe("Processing took too long");
        expect(formatList(["mp4", "mov", "webm"], en)).toBe("MP4, MOV or WEBM");
        expect(durationProblem(4, en)).toBe("This clip is 4 seconds long. Upload at least 10 seconds so the AI has enough movement to analyse.");
    });
});
