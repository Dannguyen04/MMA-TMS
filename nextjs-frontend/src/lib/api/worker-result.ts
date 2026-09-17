import { z } from "zod";

import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import { TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type {
    AIAnalysis,
    AIFinding,
    Combination,
    Detection,
    FindingImpact,
    FindingMetricRef,
    Limb,
    ModelVersions,
    MovementEvent,
    PoseFrame,
    StrikeType,
    VideoTrainingType,
} from "@/lib/domain/types";
import { average, clamp, round, sum } from "@/lib/utils";
import { computeAnalysisMetrics } from "@/lib/video/metrics";
import { KEYPOINT, KEYPOINT_COUNT, LIMB_CHAIN } from "@/lib/video/skeleton";

/**
 * Result JSON written by the Python worker (`python-worker/process_video.py`) and its mapping
 * onto the product's analysis model. Pure: usable on the server (polling) and in the browser.
 */

/* ─── Worker output ───────────────────────────────────────────────────────── */

const landmarkSchema = z.object({ x: z.number(), y: z.number(), conf: z.number() });

const frameSchema = z.object({
    frameIdx: z.number(),
    timeMs: z.number(),
    kneeAngle: z.number(),
    hipAngle: z.number(),
    elbowAngleLeft: z.number().optional(),
    elbowAngleRight: z.number().optional(),
    activeArm: z.string().optional(),
    punchState: z.string().optional(),
    punchStateLabel: z.string().optional(),
    kickState: z.string(),
    kickStateLabel: z.string(),
    activeLeg: z.string(),
    landmarks: z.array(landmarkSchema),
});

const findingSchema = z.object({
    id: z.string(),
    category: z.string(),
    title: z.string(),
    description: z.string(),
    severity: z.enum(["positive", "info", "warning", "critical"]),
    confidence: z.number(),
    frameIdx: z.number(),
    timeMs: z.number(),
    metricName: z.string(),
    metricValue: z.number(),
    recommendation: z.string(),
});

const kickSchema = z.object({
    score: z.number().nullable(),
    grade: z.string(),
    details: z.array(z.string()),
    minChamberAngle: z.number(),
    maxExtensionAngle: z.number(),
    peakSpeed: z.number(),
    startTimeMs: z.number(),
    endTimeMs: z.number(),
});

const punchSchema = z.object({
    punchType: z.string(),
    arm: z.string(),
    score: z.number().nullable(),
    grade: z.string(),
    details: z.array(z.string()),
    maxElbowAngle: z.number(),
    peakSpeed: z.number(),
    guardPreserved: z.boolean(),
    startTimeMs: z.number(),
    impactTimeMs: z.number(),
    endTimeMs: z.number(),
    findings: z.array(findingSchema),
});

const actionConfidenceSchema = z.object({
    detection: z.number().min(0).max(1).nullable(),
    classification: z.number().min(0).max(1).nullable(),
    assessment: z.number().min(0).max(1).nullable(),
});

const actionPhasesSchema = z.object({
    startFrame: z.number(),
    chamberFrame: z.number().nullable().optional(),
    launchFrame: z.number().nullable().optional(),
    peakFrame: z.number().nullable().optional(),
    impactFrame: z.number(),
    endFrame: z.number(),
    startTimeMs: z.number(),
    chamberTimeMs: z.number().nullable().optional(),
    launchTimeMs: z.number().nullable().optional(),
    peakTimeMs: z.number().nullable().optional(),
    impactTimeMs: z.number(),
    endTimeMs: z.number(),
    impactType: z.enum(["peak_extension_proxy", "max_extension_proxy"]),
});

const actionMetricItemSchema = z.object({
    value: z.union([z.number(), z.boolean(), z.string()]).nullable(),
    unit: z.string(),
    confidence: z.number().min(0).max(1).nullable().optional(),
});

const actionAssessmentSchema = z.object({
    rubricId: z.string().nullable().optional(),
    score: z.number().nullable(),
    grade: z.string(),
    status: z.enum(["excellent", "good", "fair", "needs_improvement", "insufficient_evidence"]),
    primaryError: z.string().nullable().optional(),
    criteria: z.array(z.record(z.string(), z.unknown())).optional(),
    findings: z.array(z.record(z.string(), z.unknown())).optional(),
});

const actionReviewSchema = z.object({
    status: z.enum([
        "ai_generated",
        "needs_review",
        "coach_approved",
        "coach_corrected",
        "coach_rejected",
        "insufficient_evidence",
    ]),
    reviewerId: z.string().nullable().optional(),
    reviewNotes: z.string().nullable().optional(),
});

export const techniqueCandidateSchema = z.object({
    technique: z.string(),
    family: z.string(),
    attackingSide: z.enum(["left", "right", "unknown"]),
    limbRole: z.enum(["lead", "rear", "unknown"]),
    stance: z.enum(["orthodox", "southpaw", "switch", "unknown"]),
});

export const shadowClassificationSchema = z.object({
    status: z.enum(["classified", "abstained", "rejected_candidate"]),
    candidate: techniqueCandidateSchema.nullable(),
    confidence: z.number().nullable().optional(),
    reasonCodes: z.array(z.string()),
    classifierId: z.string(),
    classifierVersion: z.string(),
    configVersion: z.string(),
    featureVersion: z.string(),
    stanceSource: z.string(),
    evidenceLevel: z.enum(["observed", "derived_proxy", "unavailable"]),
    validationStatus: z.string().optional(),
});

export const actionSchema = z.object({
    id: z.string(),
    sourceActionId: z.string(),
    family: z.enum(["punch", "kick", "other_strike", "non_strike"]),
    technique: z.string(),
    attackingSide: z.enum(["left", "right", "unknown"]),
    limbRole: z.enum(["lead", "rear", "unknown"]),
    stance: z.enum(["orthodox", "southpaw", "switch", "unknown"]),
    confidence: actionConfidenceSchema,
    phases: actionPhasesSchema,
    metrics: z.record(z.string(), actionMetricItemSchema),
    assessment: actionAssessmentSchema,
    review: actionReviewSchema,
    modelVersion: z.string().nullable().optional(),
    rubricVersion: z.string().nullable().optional(),
    shadowClassification: shadowClassificationSchema.nullable().optional(),
    qualityStatus: z.enum(["pass", "degraded", "blocked"]).optional(),
    adjustedEvidenceLevel: z.enum(["observed", "derived_proxy", "unavailable"]).optional(),
});

export const analysisQualitySchema = z.object({
    status: z.enum(["pass", "degraded", "blocked"]),
    reasonCodes: z.array(z.string()),
    metrics: z.object({
        fps: z.number(),
        durationMs: z.number(),
        totalFrames: z.number(),
        missingFrameRatio: z.number(),
        meanKeypointConfidence: z.number(),
        upperBodyCoverage: z.number(),
        lowerBodyCoverage: z.number(),
        maxSimultaneousPersons: z.number().nullable().optional(),
        targetTrackRatio: z.number().nullable().optional(),
        imgWidth: z.number().nullable().optional(),
        imgHeight: z.number().nullable().optional(),
    }),
    qualityVersion: z.string(),
    evaluatorVersion: z.string(),
    evaluatedAt: z.string(),
    adjustedEvidenceLevel: z.enum(["observed", "derived_proxy", "unavailable"]),
    recommendation: z.string(),
});

export const priorityFindingSummarySchema = z.object({
    rank: z.number(),
    code: z.string(),
    title: z.string(),
    description: z.string(),
    severity: z.string(),
    frequency: z.number(),
    priorityScore: z.number(),
    affectedActionIds: z.array(z.string()),
    representativeFrame: z.number(),
    representativeTimeMs: z.number(),
    primaryRecommendation: z.string(),
});

export const sessionInsightsSchema = z.object({
    status: z.string(),
    totalActions: z.number(),
    familyDistribution: z.record(z.string(), z.number()),
    techniqueDistribution: z.record(z.string(), z.number()),
    sideDistribution: z.record(z.string(), z.number()),
    statusDistribution: z.record(z.string(), z.number()),
    coverageSummary: z.object({
        totalDetectedActions: z.number(),
        assessedActionsCount: z.number(),
        insufficientEvidenceCount: z.number(),
        insufficientEvidenceRate: z.number(),
        unknownTechniqueCount: z.number(),
        unknownTechniqueRate: z.number(),
        degradedQualityCount: z.number(),
        degradedQualityRate: z.number(),
    }),
    priorityFindings: z.array(priorityFindingSummarySchema),
    sessionVersion: z.string(),
    qualityStatus: z.enum(["pass", "degraded", "blocked"]).optional(),
    adjustedEvidenceLevel: z.enum(["observed", "derived_proxy", "unavailable"]).optional(),
});

export const coachingDrillSchema = z.object({
    drillId: z.string(),
    title: z.string(),
    errorCode: z.string(),
    targetTechnique: z.string(),
    objective: z.string(),
    instructions: z.array(z.string()),
    safetyNote: z.string(),
    applicability: z.string(),
    contraindications: z.string(),
    recommendedReps: z.string(),
    catalogVersion: z.string(),
});

export const coachingRecommendationSchema = z.object({
    priorityRank: z.number(),
    errorCode: z.string(),
    drill: coachingDrillSchema.nullable(),
    athleteCue: z.string(),
    coachNotes: z.record(z.string(), z.unknown()),
});

export const coachingPlanSchema = z.object({
    sessionStatus: z.string(),
    recommendations: z.array(coachingRecommendationSchema),
    catalogVersion: z.string(),
    engineVersion: z.string(),
    qualityStatus: z.enum(["pass", "degraded", "blocked"]).optional(),
});

export const workerResultSchema = z.object({
    schemaVersion: z.literal("1.0.0").optional(),
    meta: z.object({
        fps: z.number(),
        totalFrames: z.number(),
        durationMs: z.number(),
        imgWidth: z.number().optional(),
        imgHeight: z.number().optional(),
        model: z.string().optional(),
    }),
    actions: z.array(actionSchema).optional(),
    frames: z.array(frameSchema),
    kicks: z.array(kickSchema),
    punches: z.array(punchSchema).optional(),
    findings: z.array(findingSchema).optional(),
    summary: z.record(z.string(), z.unknown()).optional(),
    analysisQuality: analysisQualitySchema.optional(),
    sessionInsights: sessionInsightsSchema.optional(),
    coachingPlan: coachingPlanSchema.optional(),
});

export type WorkerLandmark = z.infer<typeof landmarkSchema>;
export type WorkerFrame = z.infer<typeof frameSchema>;
export type WorkerFinding = z.infer<typeof findingSchema>;
export type WorkerKick = z.infer<typeof kickSchema>;
export type WorkerPunch = z.infer<typeof punchSchema>;
export type WorkerTechniqueCandidate = z.infer<typeof techniqueCandidateSchema>;
export type WorkerShadowClassification = z.infer<typeof shadowClassificationSchema>;
export type WorkerAction = z.infer<typeof actionSchema>;
export type WorkerAnalysisQuality = z.infer<typeof analysisQualitySchema>;
export type WorkerSessionInsights = z.infer<typeof sessionInsightsSchema>;
export type WorkerCoachingPlan = z.infer<typeof coachingPlanSchema>;
export type WorkerResult = z.infer<typeof workerResultSchema>;

/* ─── Task 10-14 Review, Findings, & Dataset Export Contracts ─────────────── */

export const evidenceReferenceSchema = z.object({
    frameIdx: z.number(),
    timeMs: z.number(),
    metricName: z.string(),
    metricValue: z.number(),
    thresholdValue: z.number().nullable().optional(),
    operator: z.string().nullable().optional(),
    unit: z.string(),
});

export const rubricProvenanceSchema = z.object({
    rubricId: z.string(),
    criterionId: z.string(),
    rubricVersion: z.string(),
});

export const standardFindingSchema = z.object({
    id: z.string(),
    code: z.string(),
    errorCode: z.string().optional(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    scope: z.enum(["action", "session"]),
    severity: z.enum(["positive", "info", "warning", "critical"]),
    confidence: z.number().nullable(),
    evidenceLevel: z.enum(["observed", "derived_proxy", "unavailable"]),
    evidenceRefs: z.array(evidenceReferenceSchema),
    provenance: rubricProvenanceSchema,
    recommendation: z.string(),
    actionId: z.string().nullable().optional(),
    legacyFindingId: z.string().nullable().optional(),
    frameIdx: z.number().optional(),
    timeMs: z.number().optional(),
    metricName: z.string().optional(),
    metricValue: z.number().optional(),
});

export const reviewAuditRecordSchema = z.object({
    recordId: z.string(),
    actionId: z.string(),
    targetField: z.enum(["technique", "attacking_side", "limb_role", "phase", "finding"]),
    reviewAction: z.enum(["accept", "correct", "reject"]),
    aiOriginalValue: z.unknown(),
    correctedValue: z.unknown(),
    reviewerId: z.string(),
    reviewerRole: z.enum(["head_coach", "coach", "assistant_coach", "system_admin", "athlete"]),
    reason: z.string(),
    timestamp: z.string(),
    idempotencyToken: z.string(),
    version: z.string(),
});

export const materializedActionViewSchema = z.object({
    actionId: z.string(),
    aiOriginal: z.record(z.string(), z.unknown()),
    effectiveTechnique: z.string(),
    effectiveAttackingSide: z.string(),
    effectiveLimbRole: z.string(),
    effectivePhases: z.record(z.string(), z.unknown()),
    effectiveFindings: z.array(z.record(z.string(), z.unknown())),
    reviewStatus: z.enum(["ai_generated", "coach_approved", "coach_corrected", "coach_rejected", "insufficient_evidence"]),
    auditTrail: z.array(reviewAuditRecordSchema),
    updatedAt: z.string(),
});

export const anonymizedSampleSchema = z.object({
    sampleId: z.string(),
    athleteHash: z.string(),
    split: z.enum(["train", "val", "test"]),
    technique: z.string(),
    attackingSide: z.string(),
    limbRole: z.string(),
    phases: z.record(z.string(), z.unknown()),
    metrics: z.record(z.string(), z.unknown()),
    reviewStatus: z.string(),
    auditHash: z.string(),
    provenanceSource: z.string(),
});

export const datasetManifestSchema = z.object({
    datasetId: z.string(),
    schemaVersion: z.string(),
    exportTimestamp: z.string(),
    policy: z.string(),
    totalSamples: z.number(),
    splitDistribution: z.record(z.string(), z.number()),
    techniqueDistribution: z.record(z.string(), z.number()),
    isGoldReady: z.boolean(),
    status: z.enum(["GOLD_READY", "NOT_GOLD_READY"]),
    contentHash: z.string(),
    datasetHash: z.string(),
    notes: z.string(),
});

export const datasetExportResultSchema = z.object({
    manifest: datasetManifestSchema,
    samples: z.array(anonymizedSampleSchema),
});

export type WorkerEvidenceReference = z.infer<typeof evidenceReferenceSchema>;
export type WorkerRubricProvenance = z.infer<typeof rubricProvenanceSchema>;
export type WorkerStandardFinding = z.infer<typeof standardFindingSchema>;
export type WorkerReviewAuditRecord = z.infer<typeof reviewAuditRecordSchema>;
export type WorkerMaterializedActionView = z.infer<typeof materializedActionViewSchema>;
export type WorkerAnonymizedSample = z.infer<typeof anonymizedSampleSchema>;
export type WorkerDatasetManifest = z.infer<typeof datasetManifestSchema>;
export type WorkerDatasetExportResult = z.infer<typeof datasetExportResultSchema>;

/** Validates untrusted JSON from the result URL. */
export function parseWorkerResult(json: unknown): WorkerResult | null {
    const parsed = workerResultSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
}

/** Pose frames for the player overlay. Frames without a full skeleton keep an empty keypoint list. */
export function posesFromWorkerFrames(frames: WorkerFrame[]): PoseFrame[] {
    return [...frames]
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((frame) => ({ timeMs: frame.timeMs, keypoints: frame.landmarks.length === KEYPOINT_COUNT ? frame.landmarks : [] }));
}

/* ─── Mapping ─────────────────────────────────────────────────────────────── */

export interface WorkerResultContext {
    analysisId: string;
    videoId: string;
    jobId: string;
    fighterId: string;
    processedAt: string;
    trainingType: VideoTrainingType;
    fighterHeightCm: number;
    models: ModelVersions;
    resultUrl: string;
}

interface Point {
    x: number;
    y: number;
}

const IMPACT_BY_SEVERITY: Record<WorkerFinding["severity"], FindingImpact> = {
    positive: "strength",
    info: "improvement",
    warning: "improvement",
    critical: "concern",
};

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Drops the translated suffix the worker appends in parentheses, e.g. "Full Arm Extension (…)". */
function cleanTitle(title: string): string {
    return title.replace(/\s*\([^)]*\)\s*$/, "").trim() || title;
}

function strikeTypeFrom(punchType: string, elbowDeg: number): StrikeType {
    const type = punchType.toLowerCase();
    if (type === "jab" || type === "cross" || type === "hook") return type;
    return elbowDeg < 125 ? "hook" : "cross";
}

export function mapWorkerResult(result: WorkerResult, context: WorkerResultContext): AIAnalysis {
    const key = context.analysisId.replace(/^an-/, "");
    const aspect = result.meta.imgWidth && result.meta.imgHeight ? result.meta.imgWidth / result.meta.imgHeight : 16 / 9;
    const durationMs = Math.max(1, Math.round(result.meta.durationMs));
    const frames = [...result.frames].sort((a, b) => a.timeMs - b.timeMs);
    const tracked = frames.filter((f) => f.landmarks.length === KEYPOINT_COUNT);

    const at = (frame: WorkerFrame, index: number): Point => ({ x: frame.landmarks[index].x * aspect, y: frame.landmarks[index].y });
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const within = (startMs: number, endMs: number) => tracked.filter((f) => f.timeMs >= startMs && f.timeMs <= endMs);

    // Scale: shoulder-to-ankle span is about 78% of standing height.
    const span = median(
        tracked.map((f) => {
            const shoulders = mid(at(f, KEYPOINT.leftShoulder), at(f, KEYPOINT.rightShoulder));
            const ankles = mid(at(f, KEYPOINT.leftAnkle), at(f, KEYPOINT.rightAnkle));
            return Math.hypot(shoulders.x - ankles.x, shoulders.y - ankles.y);
        }),
    );
    const metresPerUnit = span && span > 0.05 ? ((context.fighterHeightCm / 100) * 0.78) / span : (context.fighterHeightCm / 100) * 1.2;

    const limbConfidence = (limb: Limb, windowFrames: WorkerFrame[]): number => {
        const chain = LIMB_CHAIN[limb];
        const values = windowFrames.flatMap((f) => [f.landmarks[chain.root].conf, f.landmarks[chain.joint].conf, f.landmarks[chain.end].conf]);
        return values.length > 0 ? round(average(values), 2) : 0.5;
    };

    const motion = (limb: Limb, windowFrames: WorkerFrame[]): { peakSpeed: number | null; accelerationProxy: number } => {
        const end = LIMB_CHAIN[limb].end;
        const speeds: { t: number; v: number }[] = [];
        for (let i = 1; i < windowFrames.length; i++) {
            const dt = (windowFrames[i].timeMs - windowFrames[i - 1].timeMs) / 1000;
            if (dt <= 0) continue;
            const a = at(windowFrames[i - 1], end);
            const b = at(windowFrames[i], end);
            speeds.push({ t: windowFrames[i].timeMs, v: (Math.hypot(b.x - a.x, b.y - a.y) * metresPerUnit) / dt });
        }
        if (speeds.length === 0) return { peakSpeed: null, accelerationProxy: 0 };
        let maxAccel = 0;
        for (let i = 1; i < speeds.length; i++) {
            const dt = (speeds[i].t - speeds[i - 1].t) / 1000;
            if (dt > 0) maxAccel = Math.max(maxAccel, (speeds[i].v - speeds[i - 1].v) / dt);
        }
        return { peakSpeed: Math.max(...speeds.map((s) => s.v)), accelerationProxy: round(clamp((maxAccel / 250) * 10, 0, 10), 1) };
    };

    const hipRotation = (windowFrames: WorkerFrame[], peakMs: number): number => {
        if (windowFrames.length < 2) return 0;
        const width = (f: WorkerFrame) => Math.abs(at(f, KEYPOINT.leftHip).x - at(f, KEYPOINT.rightHip).x);
        const first = width(windowFrames[0]);
        const peakFrame = windowFrames.reduce((best, f) => (Math.abs(f.timeMs - peakMs) < Math.abs(best.timeMs - peakMs) ? f : best));
        const peak = width(peakFrame);
        const larger = Math.max(first, peak);
        if (larger === 0) return 0;
        return Math.round((Math.acos(clamp(Math.min(first, peak) / larger, 0, 1)) * 180) / Math.PI);
    };

    const oppositeHandUp = (limb: Limb, frame: WorkerFrame): boolean => {
        const leftSide = limb.startsWith("right");
        const wrist = at(frame, leftSide ? KEYPOINT.leftWrist : KEYPOINT.rightWrist);
        const shoulder = at(frame, leftSide ? KEYPOINT.leftShoulder : KEYPOINT.rightShoulder);
        return wrist.y <= shoulder.y + 0.04;
    };

    interface Draft {
        detection: Omit<Detection, "id">;
        chamberDeg: number | null;
    }

    const drafts: Draft[] = [];
    for (const punch of result.punches ?? []) {
        const limb: Limb = punch.arm === "left" ? "left_arm" : "right_arm";
        const windowFrames = within(punch.startTimeMs, punch.endTimeMs);
        const { peakSpeed, accelerationProxy } = motion(limb, windowFrames);
        drafts.push({
            chamberDeg: null,
            detection: {
                type: strikeTypeFrom(punch.punchType, punch.maxElbowAngle),
                limb,
                startMs: Math.round(punch.startTimeMs),
                peakMs: Math.round(punch.impactTimeMs),
                endMs: Math.round(punch.endTimeMs),
                confidence: limbConfidence(limb, windowFrames),
                peakSpeed: round(clamp(peakSpeed ?? punch.peakSpeed * metresPerUnit, 0, 30), 1),
                accelerationProxy,
                jointAngleDeg: Math.round(punch.maxElbowAngle),
                hipRotationDeg: hipRotation(windowFrames, punch.impactTimeMs),
                guardMaintained: punch.guardPreserved,
                combinationId: null,
                review: null,
            },
        });
    }
    for (const kick of result.kicks) {
        const windowFrames = within(kick.startTimeMs, kick.endTimeMs);
        const allWindow = frames.filter((f) => f.timeMs >= kick.startTimeMs && f.timeMs <= kick.endTimeMs);
        const leftVotes = allWindow.filter((f) => f.activeLeg === "left").length;
        const rightVotes = allWindow.filter((f) => f.activeLeg === "right").length;
        const limb: Limb = leftVotes > rightVotes ? "left_leg" : "right_leg";
        const ankle = LIMB_CHAIN[limb].end;
        const peakFrame = windowFrames.length > 0 ? windowFrames.reduce((best, f) => (f.landmarks[ankle].y < best.landmarks[ankle].y ? f : best)) : null;
        const peakMs = Math.round(peakFrame?.timeMs ?? (kick.startTimeMs + kick.endTimeMs) / 2);
        const { peakSpeed, accelerationProxy } = motion(limb, windowFrames);
        drafts.push({
            chamberDeg: kick.minChamberAngle,
            detection: {
                type: "kick",
                limb,
                startMs: Math.round(kick.startTimeMs),
                peakMs,
                endMs: Math.round(kick.endTimeMs),
                confidence: limbConfidence(limb, windowFrames),
                peakSpeed: round(clamp(peakSpeed ?? kick.peakSpeed * metresPerUnit, 0, 30), 1),
                accelerationProxy,
                jointAngleDeg: Math.round(kick.maxExtensionAngle),
                hipRotationDeg: hipRotation(windowFrames, peakMs),
                guardMaintained: peakFrame ? oppositeHandUp(limb, peakFrame) : true,
                combinationId: null,
                review: null,
            },
        });
    }

    drafts.sort((a, b) => a.detection.startMs - b.detection.startMs);
    const detections: Detection[] = drafts.map((d, i) => ({ ...d.detection, id: `det-${key}-${pad(i + 1, 3)}` }));

    // Combinations: strikes that follow each other within 450 ms.
    const combinations: Combination[] = [];
    let group: Detection[] = [];
    const closeGroup = () => {
        if (group.length >= 2) {
            const id = `cmb-${key}-${pad(combinations.length + 1, 2)}`;
            group.forEach((d) => (d.combinationId = id));
            combinations.push({
                id,
                label: group.map((d) => TECHNIQUE_LABELS[d.type]).join(" – "),
                detectionIds: group.map((d) => d.id),
                startMs: group[0].startMs,
                endMs: group[group.length - 1].endMs,
                confidence: round(average(group.map((d) => d.confidence)) * 0.97, 2),
            });
        }
        group = [];
    };
    for (const detection of detections) {
        const previous = group[group.length - 1];
        if (previous && detection.startMs - previous.endMs > 450) closeGroup();
        group.push(detection);
    }
    closeGroup();

    // Movement events the worker output supports: guard drops and tracking gaps.
    const drafted: Omit<MovementEvent, "id">[] = [];
    for (const detection of detections) {
        if (detection.guardMaintained) continue;
        const after = tracked.filter((f) => f.timeMs > detection.endMs && f.timeMs <= detection.endMs + 1500);
        const recovered = after.find((f) => oppositeHandUp(detection.limb, f));
        const endMs = recovered ? Math.round(recovered.timeMs) : detection.endMs + 400;
        const hand = detection.limb.startsWith("left") ? "Right hand" : "Left hand";
        drafted.push({
            type: "guard_drop",
            startMs: Math.max(0, detection.endMs - 40),
            endMs,
            confidence: detection.confidence,
            detail: `${hand} dropped below the chin after the ${TECHNIQUE_LABELS[detection.type].toLowerCase()}`,
        });
    }
    let gapStart: number | null = null;
    frames.forEach((frame, index) => {
        const lost = frame.landmarks.length !== KEYPOINT_COUNT;
        const last = index === frames.length - 1;
        if (lost && gapStart === null) gapStart = frame.timeMs;
        if (gapStart !== null && (!lost || last)) {
            const endMs = frame.timeMs;
            if (endMs - gapStart >= 300) {
                drafted.push({ type: "tracking_lost", startMs: Math.round(gapStart), endMs: Math.round(endMs), confidence: 0.95, detail: "Fighter not detected in frame" });
            }
            gapStart = null;
        }
    });
    const events: MovementEvent[] = drafted.sort((a, b) => a.startMs - b.startMs).map((e, i) => ({ ...e, id: `mv-${key}-${pad(i + 1, 3)}` }));

    const strikeMs = sum(combinations.map((c) => c.endMs - c.startMs)) + sum(detections.filter((d) => !d.combinationId).map((d) => d.endMs - d.startMs));
    const lostMs = sum(events.filter((e) => e.type === "tracking_lost").map((e) => e.endMs - e.startMs));
    const stanceWidth = median(
        tracked.map((f) => {
            const shoulders = Math.abs(at(f, KEYPOINT.leftShoulder).x - at(f, KEYPOINT.rightShoulder).x);
            const ankles = Math.abs(at(f, KEYPOINT.leftAnkle).x - at(f, KEYPOINT.rightAnkle).x);
            return shoulders > 0.01 ? ankles / shoulders : 0;
        }),
    );
    const hipHeights = tracked.map((f) => mid(at(f, KEYPOINT.leftHip), at(f, KEYPOINT.rightHip)).y);
    const hipMean = average(hipHeights);
    const hipSpread = Math.sqrt(average(hipHeights.map((y) => (y - hipMean) ** 2)));

    const metrics = computeAnalysisMetrics({
        durationMs,
        trainingType: context.trainingType,
        detections,
        combinationCount: combinations.length,
        events,
        kickChamberDeg: drafts.map((d) => d.chamberDeg).filter((v): v is number => v !== null),
        targetDistances: [],
        restMs: Math.max(0, durationMs - strikeMs - lostMs),
        breakMs: 0,
        restGuardLapse: 0.1,
        stanceWidthRatio: round(stanceWidth ?? 1.25, 2),
        balanceScore: Math.round(clamp(100 - hipSpread * 600, 35, 98)),
    });

    const workerFindings = result.findings ?? (result.punches ?? []).flatMap((p) => p.findings);
    const findings: AIFinding[] = workerFindings.map((finding, index) => {
        const nearest = detections.reduce<Detection | null>(
            (best, d) => (Math.abs(d.peakMs - finding.timeMs) <= 800 && (!best || Math.abs(d.peakMs - finding.timeMs) < Math.abs(best.peakMs - finding.timeMs)) ? d : best),
            null,
        );
        return {
            id: `fd-${key}-${index + 1}`,
            category: finding.category === "guard" ? "guard" : (nearest?.type ?? "movement_quality"),
            impact: IMPACT_BY_SEVERITY[finding.severity],
            title: cleanTitle(finding.title),
            description: finding.description,
            confidence: round(clamp(finding.confidence, 0, 1), 2),
            timestampsMs: [Math.round(finding.timeMs)],
            detectionIds: nearest ? [nearest.id] : [],
            metric: metricRef(finding, nearest),
            recommendation: finding.recommendation,
            review: null,
        };
    });

    const overallConfidence = detections.length > 0 ? round(average(detections.map((d) => d.confidence)), 2) : 0;
    const lowCount = detections.filter((d) => d.confidence < LOW_CONFIDENCE_THRESHOLD).length;

    return {
        id: context.analysisId,
        videoId: context.videoId,
        jobId: context.jobId,
        fighterId: context.fighterId,
        processedAt: context.processedAt,
        durationMs,
        fps: result.meta.fps,
        models: { ...context.models, pose: result.meta.model ?? context.models.pose },
        overallConfidence,
        trackingQuality: frames.length > 0 ? round(tracked.length / frames.length, 2) : 0,
        summary:
            `The model detected ${detections.length} strikes (${metrics.strikesPerMin} per minute), including ${metrics.combinations} combinations, with an estimated guard uptime of ${metrics.guard.uptimePct}%. ` +
            (lowCount > 0 ? `${lowCount} detections fell below 60% confidence and are marked for coach review.` : "Detections with confidence below 60% are marked for coach review."),
        detections,
        combinations,
        movementEvents: events,
        metrics,
        findings,
        alertIds: [],
        coachReview: null,
        resultUrl: context.resultUrl,
    };
}

function metricRef(finding: WorkerFinding, detection: Detection | null): FindingMetricRef {
    switch (finding.metricName) {
        case "maxElbowAngle":
            return { label: "Elbow extension at impact", value: Math.round(finding.metricValue), unit: "°", reference: "Target 155–175°" };
        case "peakSpeed":
            return { label: "Peak hand speed", value: detection?.peakSpeed ?? round(finding.metricValue, 2), unit: detection ? "m/s" : "u/s", reference: null };
        case "guardPreserved":
            return { label: "Guard kept during the strike", value: finding.metricValue >= 1 ? 100 : 0, unit: "%", reference: null };
        default:
            return { label: finding.metricName, value: round(finding.metricValue, 1), unit: "", reference: null };
    }
}
