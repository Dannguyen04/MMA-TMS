import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { MovementEvidencePanel } from "@/components/video/movement-evidence-panel";
import { createPlaybackStore, PlaybackProvider } from "@/components/video/playback-store";
import { movementEvidenceSchema } from "@/lib/domain/movement-evidence";
import { AI_RESULTS_HIDDEN, mapWorkerResult, parseWorkerResult, type WorkerResultContext } from "./worker-result";

// This panel has no navigation links; isolate Next's router in the unit renderer.
vi.mock("next/link", () => ({ default: "a" }));

function evidence() {
    return {
        schemaVersion: "1.0.0", reportVersion: "movement_evidence_v1", status: "review_ready",
        context: { exerciseId: "assigned-drill", protocolId: "upper_body_v1", purpose: "training",
            source: "declared", exerciseVerified: false, trainingMode: "shadow_boxing", cameraView: "side" },
        coverage: { totalFrames: 12, freshPoseFrames: 12, usableFrames: 12, usableRatio: 1, excludedByReason: {} },
        reasonCodes: [], recordingGuidance: [],
        windows: [{ id: "movement-window-0001", startFrame: 0, endFrame: 11, startMs: 0, endMs: 366.667,
            sampleCount: 12, confidence: null, reviewStatus: "requires_review" }],
        measurementPolicy: { validationStatus: "NOT_VALIDATED", assessmentEnabled: false, clinicalUseEnabled: false,
            automaticComparisonEnabled: false, repetitionCount: null },
        provenance: { poseModel: "yolov8n-pose", qualityVersion: "1.0.0", requiredKeypoints: [5, 6, 7, 8, 9, 10],
            minKeypointConfidence: .5, minimumWindowMs: 250, minimumWindowFrames: 6, maxWindowSeconds: 5,
            thresholdStatus: "ENGINEERING_DEFAULTS_NOT_CLINICALLY_VALIDATED" },
        limitations: ["Review windows are not repetitions."],
    };
}

function payload() {
    return { meta: { fps: 30, totalFrames: 12, durationMs: 400 }, kicks: [], punches: [],
        frames: Array.from({ length: 12 }, (_, i) => ({ frameIdx: i, timeMs: i * 1000 / 30, landmarks: [] })),
        movementEvidence: evidence() };
}

const context: WorkerResultContext = {
    analysisId: "an-job", jobId: "job", videoId: "video", fighterId: "fighter", processedAt: "2026-10-03T00:00:00Z",
    trainingType: "shadow_boxing", fighterHeightCm: 175, resultUrl: "/result",
    models: { pose: "pose", action: "legacy", detection: "legacy", anomaly: "legacy" },
};

/** A panel inside a playback provider, as the analysis page renders it. */
/** The panel's English copy is what these assertions read, so render it in English (Vietnamese is the app default). */
const inPlayback = (child: ReactElement) =>
    createElement(LocaleProvider, { locale: "en" } as ComponentProps<typeof LocaleProvider>,
        createElement(PlaybackProvider, { store: createPlaybackStore(400) } as ComponentProps<typeof PlaybackProvider>, child));

describe("movement evidence contract", () => {
    it.skipIf(!AI_RESULTS_HIDDEN)("works without a single detected strike and never enables autonomous assessment", () => {
        const parsed = parseWorkerResult(payload());
        expect(parsed).not.toBeNull();
        const analysis = mapWorkerResult(parsed!, context);
        expect(analysis.movementEvidence?.windows).toHaveLength(1);
        expect(analysis.detections).toEqual([]);
        expect(analysis.findings).toEqual([]);
        expect(analysis.coachingEligible).toBe(false);
        expect(analysis.summary).toContain("not repetitions or verified strikes");
        expect(analysis.overallConfidence).toBeNull();
    });
    it.skipIf(AI_RESULTS_HIDDEN)("shows the model output instead of the evidence-only view while AI results are unhidden", () => {
        const analysis = mapWorkerResult(parseWorkerResult(payload())!, context);
        expect(analysis.movementEvidence).toBeUndefined();
        expect(analysis.coachingEligible).toBe(false);
        expect(analysis.summary).toContain("strike candidates");
    });
    it.each(["assessmentEnabled", "clinicalUseEnabled", "automaticComparisonEnabled"])("rejects %s promotion", key => {
        const data = evidence();
        Object.assign(data.measurementPolicy, { [key]: true });
        expect(movementEvidenceSchema.safeParse(data).success).toBe(false);
    });
    it("rejects coverage that counts missing evidence as usable", () => {
        const data = evidence();
        data.coverage.freshPoseFrames = 3;
        expect(movementEvidenceSchema.safeParse(data).success).toBe(false);
    });
    it("rejects overlapping windows and recapture reports with usable windows", () => {
        const data = evidence();
        data.windows.push({ ...data.windows[0], id: "different-id" });
        expect(movementEvidenceSchema.safeParse(data).success).toBe(false);
        data.windows.pop();
        data.status = "recapture";
        expect(movementEvidenceSchema.safeParse(data).success).toBe(false);
    });
    it("rejects evidence outside the source timeline instead of falling back to legacy scores", () => {
        const data = payload();
        data.meta.durationMs = 300;
        expect(parseWorkerResult(data)).toBeNull();
        data.meta.durationMs = 400;
        data.frames[11].frameIdx = 12;
        expect(parseWorkerResult(data)).toBeNull();
    });
    it("keeps older results compatible without inventing a report", () => {
        const legacy: Record<string, unknown> = { ...payload() };
        delete legacy.movementEvidence;
        expect(parseWorkerResult(legacy)?.movementEvidence).toBeUndefined();
    });
    it("renders declared context, review windows and explicit limitations", () => {
        const report = movementEvidenceSchema.parse(evidence());
        const html = renderToStaticMarkup(inPlayback(createElement(MovementEvidencePanel, { report })));
        expect(html).toContain("Movement evidence");
        expect(html).toContain("assigned-drill");
        expect(html).toContain("not AI accuracy");
        expect(html).toContain("Review footage");
        expect(html).toContain("No validated technique score");
    });
    it("renders recapture guidance with no fabricated review markers", () => {
        const data = evidence();
        data.status = "recapture";
        data.windows = [];
        data.coverage.usableFrames = 0;
        data.coverage.usableRatio = 0;
        data.recordingGuidance = [];
        const report = movementEvidenceSchema.parse(data);
        const html = renderToStaticMarkup(inPlayback(createElement(MovementEvidencePanel, { report })));
        expect(html).toContain("New recording or reprocessing required");
        expect(html).not.toContain("aria-label=\"Review footage");
    });
});
