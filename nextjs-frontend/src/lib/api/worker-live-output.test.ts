import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { mapWorkerResult, workerResultSchema } from "./worker-result";

// Opt-in cross-language contract smoke test; no public media committed to Git.
const resultFile = process.env.WORKER_RESULT_FILE;
it.skipIf(!resultFile)("maps real guarded worker output without inventing techniques or scores", () => {
    const result = workerResultSchema.parse(JSON.parse(readFileSync(resultFile!, "utf8")));
    expect(result.productionReadiness).toMatchObject({ status: "BLOCKED", assessmentEnabled: false });
    expect(result.actions?.every(a => a.assessment.score === null && a.confidence.classification === null)).toBe(true);
    const analysis = mapWorkerResult(result, {
        analysisId: "an-research", videoId: "research", jobId: "research", fighterId: "research",
        processedAt: "2026-10-03T00:00:00Z", trainingType: "shadow_boxing", fighterHeightCm: 175,
        models: { pose: "yolov8n-pose", action: "legacy", detection: "legacy", anomaly: "legacy" }, resultUrl: "/local-only",
    });
    expect(analysis.detections.length).toBe((result.punches?.length ?? 0) + result.kicks.length);
    expect(analysis.detections.filter(d => d.type !== "kick").every(d => d.type === "punch")).toBe(true);
    expect(analysis.metrics.strikeCounts.cross).toBe(0);
    expect(analysis.coachingEligible).toBe(false);
    expect(analysis.overallConfidence).toBeNull();
    expect(analysis.findings).toEqual([]);
    if (result.movementEvidence) {
        expect(analysis.movementEvidence).toEqual(result.movementEvidence);
        expect(analysis.movementEvidence?.measurementPolicy.clinicalUseEnabled).toBe(false);
        expect(analysis.combinations).toEqual([]);
        expect(analysis.movementEvents.every(e => e.type !== "guard_drop")).toBe(true);
    }
});
