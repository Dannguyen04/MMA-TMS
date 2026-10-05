import { z } from "zod";

const count = z.number().int().nonnegative();
const windowSchema = z.object({
    id: z.string().min(1), startFrame: count, endFrame: count,
    startMs: z.number().finite().nonnegative(), endMs: z.number().finite().nonnegative(),
    sampleCount: count.min(6), confidence: z.null(), reviewStatus: z.literal("requires_review"),
}).refine(w => w.endFrame >= w.startFrame && w.endMs - w.startMs >= 250 &&
    w.sampleCount === w.endFrame - w.startFrame + 1, "Invalid evidence window");

/** Versioned, non-clinical evidence contract. Unknown versions fail closed. */
export const movementEvidenceSchema = z.object({
    schemaVersion: z.literal("1.0.0"), reportVersion: z.literal("movement_evidence_v1"),
    status: z.enum(["review_ready", "limited", "recapture"]),
    context: z.object({
        exerciseId: z.string().trim().min(1).max(120).nullable(),
        protocolId: z.enum(["whole_body_v1", "upper_body_v1", "lower_body_v1"]),
        purpose: z.enum(["training", "longitudinal_monitoring", "rehabilitation"]),
        source: z.enum(["declared", "unspecified"]), exerciseVerified: z.literal(false),
        trainingMode: z.string().nullable(), cameraView: z.string().nullable(),
    }),
    coverage: z.object({
        totalFrames: count, freshPoseFrames: count, usableFrames: count,
        usableRatio: z.number().finite().min(0).max(1),
        excludedByReason: z.record(z.string(), count),
    }),
    reasonCodes: z.array(z.string()),
    recordingGuidance: z.array(z.object({ code: z.string(), message: z.string() })),
    windows: z.array(windowSchema),
    measurementPolicy: z.object({
        validationStatus: z.literal("NOT_VALIDATED"), assessmentEnabled: z.literal(false),
        clinicalUseEnabled: z.literal(false), automaticComparisonEnabled: z.literal(false),
        repetitionCount: z.null(),
    }),
    provenance: z.object({
        poseModel: z.string().nullable(), qualityVersion: z.string().nullable(),
        requiredKeypoints: z.array(count.max(16)).min(1),
        minKeypointConfidence: z.number().min(0).max(1), minimumWindowMs: z.literal(250),
        minimumWindowFrames: z.literal(6), maxWindowSeconds: z.literal(5),
        thresholdStatus: z.literal("ENGINEERING_DEFAULTS_NOT_CLINICALLY_VALIDATED"),
    }),
    limitations: z.array(z.string()),
}).superRefine((report, ctx) => {
    const c = report.coverage;
    const expected = c.totalFrames ? c.usableFrames / c.totalFrames : 0;
    if (c.usableFrames > c.freshPoseFrames || c.freshPoseFrames > c.totalFrames || Math.abs(c.usableRatio - expected) > .0001)
        ctx.addIssue({ code: "custom", message: "Inconsistent coverage" });
    if ((report.status === "recapture") !== (report.windows.length === 0))
        ctx.addIssue({ code: "custom", message: "Inconsistent review status" });
    if ((report.context.source === "declared") !== (report.context.exerciseId !== null))
        ctx.addIssue({ code: "custom", message: "Inconsistent declared exercise" });
    const ids = new Set<string>();
    let windowFrames = 0;
    let endFrame = -1;
    let endMs = -1;
    for (const w of report.windows) {
        if (ids.has(w.id) || w.startFrame <= endFrame || w.startMs <= endMs || w.sampleCount > c.usableFrames)
            ctx.addIssue({ code: "custom", message: "Overlapping or invalid evidence windows" });
        ids.add(w.id);
        windowFrames += w.sampleCount;
        endFrame = w.endFrame;
        endMs = w.endMs;
    }
    if (windowFrames > c.usableFrames)
        ctx.addIssue({ code: "custom", message: "Windows exceed usable frame coverage" });
});

export type MovementEvidence = z.infer<typeof movementEvidenceSchema>;

export const MOVEMENT_REVIEW_LABELS: Record<MovementEvidence["status"], string> = {
    review_ready: "Footage available for review",
    limited: "Partial footage available for review",
    recapture: "New recording or reprocessing required",
};
