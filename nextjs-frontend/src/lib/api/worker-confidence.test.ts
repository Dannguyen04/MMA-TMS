import { describe, expect, it } from "vitest";
import { formatConfidence } from "../format";
import { mapWorkerResult, parseWorkerResult, type WorkerResultContext } from "./worker-result";

const context: WorkerResultContext = {
    analysisId: "an-job", videoId: "video", jobId: "job", fighterId: "fighter",
    processedAt: "2026-10-03T00:00:00Z", trainingType: "heavy_bag", fighterHeightCm: 175,
    models: { pose: "pose", action: "legacy", detection: "legacy", anomaly: "legacy" }, resultUrl: "/result",
};

describe("unknown confidence is not zero probability", () => {
    it("keeps unsupported punch labels unclassified instead of guessing cross or hook", () => {
        const parsed = parseWorkerResult({ meta: { fps: 30, totalFrames: 30, durationMs: 1000 },
            frames: [], kicks: [], punches: [{ punchType: "Unknown punch", arm: "right", score: null,
                grade: "INSUFFICIENT_EVIDENCE", details: [], maxElbowAngle: 165, peakSpeed: 1,
                guardPreserved: true, startTimeMs: 100, impactTimeMs: 200, endTimeMs: 300, findings: [] }] });
        const analysis = mapWorkerResult(parsed!, context);
        expect(analysis.detections[0].type).toBe("punch");
        expect(analysis.metrics.strikeCounts.punch).toBe(1);
        expect(analysis.metrics.strikeCounts.cross).toBe(0);
        expect(analysis.coachingEligible).toBe(false);
    });
    it("distinguishes missing confidence from a measured zero", () => {
        expect(formatConfidence(null)).toBe("Unavailable");
        expect(formatConfidence(0)).toBe("0%");
    });
    it("does not invent detector or combination confidence for legacy results", () => {
        const punch = { punchType: "cross", arm: "right", score: null, grade: "N/A", details: [],
            maxElbowAngle: 160, peakSpeed: 1, guardPreserved: true,
            startTimeMs: 100, impactTimeMs: 200, endTimeMs: 300, findings: [] };
        const parsed = parseWorkerResult({ meta: { fps: 25, totalFrames: 25, durationMs: 1000 },
            frames: [], kicks: [], punches: [punch, { ...punch, startTimeMs: 400, impactTimeMs: 500, endTimeMs: 600 }] });
        expect(parsed).not.toBeNull();
        const analysis = mapWorkerResult(parsed!, context);
        expect(analysis.detections).toHaveLength(2);
        expect(analysis.detections.every(d => d.confidence === null && d.confidenceAvailable === false)).toBe(true);
        expect(analysis.overallConfidence).toBeNull();
        expect(analysis.combinations[0].confidence).toBeNull();
        expect(analysis.coachingEligible).toBe(false);
    });
});
