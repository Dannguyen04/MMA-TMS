import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type {
    AbnormalMovementAlert,
    AIAnalysis,
    AIJob,
    AIModel,
    AlertStatus,
    BodyRegion,
    CameraAngle,
    Detection,
    DoctorDecision,
    PipelineStage,
    Video,
    VideoTrainingType,
} from "@/lib/domain/types";
import { dayKey, formatTime } from "@/lib/format";
import { average, round, sum } from "@/lib/utils";
import {
    crossExtensionFinding,
    emphasise,
    findingContext,
    generateAnalysis,
    guardAfterLeadHookFinding,
    guardRecoveryAfter,
    guardUptimeFinding,
    headMovementFinding,
    jabRangeFinding,
    kickGuardFinding,
    kickRotationFinding,
    lowConfidenceHooksFinding,
    meanOf,
    pivotFinding,
    PRODUCTION_MODEL_VERSIONS,
    REPERTOIRES,
    resolveTuning,
    speedFadeFinding,
    strikesIn,
    withoutMoves,
    type FindingContext,
    type FindingTemplate,
    type ReviewSeed,
    type ScriptTuning,
    type WeightedCombo,
} from "./ai-generation";
import { mockFighters, mockUsers } from "./people";
import { createRandom } from "./random";
import { clampPastToday, daysAgo, fromToday } from "./time";

/**
 * Video & AI seed: uploaded footage, pipeline jobs, generated analyses, abnormal movement
 * alerts and the model registry. Follows the fighter storylines in people.ts.
 *
 * Id convention: video v-X ↔ job job-X ↔ analysis an-X. Earlier failed runs of a video that were
 * re-run successfully keep their own job row (job-X-a1); the video points at the newest job.
 */

/* ─── Models ──────────────────────────────────────────────────────────────── */

const MODEL = {
    fighterDetection: "mdl-fighter-det-2-1-0",
    poseMedium: "mdl-yolov8m-pose-1-4-0",
    poseNano: "mdl-yolov8n-pose-1-2-0",
    strike: "mdl-strike-cls-2-3-1",
    strikeRc: "mdl-strike-cls-2-4-0-rc1",
    anomaly: "mdl-move-anomaly-0-9-2-beta",
    anomalyRc: "mdl-move-anomaly-1-0-0-rc1",
} as const;

const PIPELINE_MODEL_IDS = [MODEL.fighterDetection, MODEL.poseMedium, MODEL.strike, MODEL.anomaly];

/* ─── Plan types ──────────────────────────────────────────────────────────── */

interface FailurePlan {
    code: string;
    message: string;
    stage: PipelineStage;
    progressPct: number;
    workerId: string;
    runSec: number;
    attempts: number;
}

interface AnalysisPlan {
    repertoire: WeightedCombo[];
    tuning: Partial<ScriptTuning>;
    summaryNote: string;
    findings: FindingTemplate[];
    /** Coach review of the whole analysis; null while it waits in the review queue. */
    review: { reviewerId: string; reviewedAt: string; rating: number; summary: string } | null;
}

type Outcome =
    | { status: "completed"; workerId: string; processingRatio: number; attempts: number; analysis: AnalysisPlan }
    | { status: "processing"; workerId: string; stage: PipelineStage; progressPct: number }
    | { status: "queued" }
    | { status: "failed"; failure: FailurePlan };

interface VideoPlan {
    key: string;
    fighterId: string;
    uploadedById: string;
    sessionId: string | null;
    title: string;
    trainingType: VideoTrainingType;
    cameraAngle: CameraAngle;
    resolution: "1920x1080" | "1080x1920" | "3840x2160";
    fps: 30 | 60;
    durationSec: number;
    uploadedAt: string;
    fileStyle: "camera" | "android" | "iphone";
    notes: string | null;
    /** An earlier failed run, re-run successfully `retryAfterMin` later as a new job. */
    earlierFailure?: FailurePlan & { retryAfterMin: number };
    outcome: Outcome;
}

/* ─── Review helpers ──────────────────────────────────────────────────────── */

const confirmed = (note: string | null = null): ReviewSeed => ({ decision: "confirmed", note, correctedLabel: null });
const corrected = (correctedLabel: string, note: string): ReviewSeed => ({ decision: "corrected", note, correctedLabel });
const rejected = (note: string): ReviewSeed => ({ decision: "rejected", note, correctedLabel: null });

const RAFAEL = "u-rafael-costa";
const ANNA = "u-anna-volkova";

/** Analyses generated so far, oldest first — later scripts compare against earlier footage. */
const generated = new Map<string, AIAnalysis>();

function baselineOf(key: string): FindingContext | null {
    const analysis = generated.get(key);
    return analysis ? findingContext(analysis) : null;
}

/* ─── Custom finding templates ────────────────────────────────────────────── */

function trackingGapFinding(cause: string, review: ReviewSeed | null = null): FindingTemplate {
    const lost = (ctx: FindingContext) => ctx.events.filter((e) => e.type === "tracking_lost");
    return {
        category: "movement_quality",
        impact: "improvement",
        title: "Tracking was interrupted in parts of the clip",
        description: (ctx) =>
            `Tracking was lost ${lost(ctx).length} times (${round(sum(lost(ctx).map((e) => e.endMs - e.startMs)) / 1000, 1)} s in total) — ${cause}. Metrics for those moments are estimated.`,
        confidence: 0.9,
        evidence: { from: "events", types: ["tracking_lost"], limit: 5 },
        metric: (ctx) => ({ label: "Time without tracking", value: round(sum(lost(ctx).map((e) => e.endMs - e.startMs)) / 1000, 1), unit: "s", reference: null }),
        recommendation: "Film from a raised corner angle, 3–4 m away, so the fighter stays fully in frame.",
        review,
        when: (ctx) => lost(ctx).length >= 3,
    };
}

function stanceSwitchFinding(review: ReviewSeed | null = null): FindingTemplate {
    const southpawShare = (ctx: FindingContext) => {
        const jabs = strikesIn(ctx, { type: "jab" });
        return jabs.length === 0 ? 0 : Math.round((jabs.filter((j) => j.limb === "right_arm").length / jabs.length) * 100);
    };
    return {
        category: "footwork",
        impact: "strength",
        title: "Stance switches appear balanced",
        description: (ctx) =>
            `About ${southpawShare(ctx)}% of jabs were thrown from southpaw, with an estimated balance score of ${ctx.metrics.footwork.balanceScore}/100.`,
        confidence: 0.77,
        evidence: { from: "detections", type: "jab", limb: "right_arm", limit: 4 },
        metric: (ctx) => ({ label: "Jabs thrown from southpaw", value: southpawShare(ctx), unit: "%", reference: null }),
        recommendation: "Keep switching on the move; add a rear-hand counter immediately after each switch.",
        review,
    };
}

function teepFinding(review: ReviewSeed | null = null): FindingTemplate {
    return {
        category: "kick",
        impact: "strength",
        title: "Kicks appear fast and well chambered",
        description: (ctx) =>
            `Kicks averaged a ${ctx.metrics.avgKickChamberDeg}° knee chamber and ${ctx.metrics.avgPeakSpeed.kick} m/s peak foot speed.`,
        confidence: 0.84,
        evidence: { from: "detections", type: "kick", rankBy: "peakSpeed", limit: 4 },
        metric: (ctx) => ({ label: "Average kick chamber", value: ctx.metrics.avgKickChamberDeg, unit: "°", reference: "Typical 40–75°" }),
        recommendation: "Maintain the chamber height and retract faster so the kick cannot be caught.",
        review,
        when: (ctx) => ctx.metrics.strikeCounts.kick >= 3,
    };
}

/* ─── Video plans ─────────────────────────────────────────────────────────── */

/** Kick-volume bag rounds: most combinations finish with a kick. */
const LINH_KICK_ROUNDS: WeightedCombo[] = [
    { moves: ["rear_kick"], weight: 5 },
    { moves: ["teep"], weight: 4 },
    { moves: ["switch_kick"], weight: 3 },
    { moves: ["jab", "rear_kick"], weight: 4 },
    { moves: ["jab", "cross", "rear_kick"], weight: 2 },
    { moves: ["lead_hook", "rear_kick"], weight: 2 },
    { moves: ["jab", "cross"], weight: 2 },
    { moves: ["jab"], weight: 2 },
];

const VIDEO_PLANS: VideoPlan[] = [
    {
        key: "minh-pads-2d",
        fighterId: "f-minh-tran",
        uploadedById: RAFAEL,
        sessionId: "s-minh-pads-2d",
        title: "Pad work — 8 rounds, hook focus",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 192,
        uploadedAt: daysAgo(2, 19, 12),
        fileStyle: "camera",
        notes: "Highlights of 8 × 3 min rounds compressed to 3:12. Watch the right hand after the lead hooks.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.94,
            attempts: 1,
            analysis: {
                repertoire: emphasise(REPERTOIRES.muay_thai, "lead_hook", 1.6),
                tuning: {
                    roundLengthSec: 24,
                    restSec: [1.3, 2.7],
                    kickSpeedFactor: 1.02,
                    hookConfusionRate: 0.2,
                    guardDropRates: { lead_hook: 0.45, rear_kick: 0.12 },
                    guardRecoveryMs: [380, 640],
                    restGuardLapse: 0.14,
                    headMovesPerMin: 6.5,
                    pivotRate: 0.2,
                    hookElbowDeg: [96, 124],
                    stanceWidthRatio: 1.31,
                    balanceScore: 84,
                },
                summaryNote: "Tracking was stable apart from brief pad-holder occlusions; several hooks were classified with low confidence and are marked for review.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { confidence: 0.82 }),
                    {
                        category: "hook",
                        impact: "improvement",
                        title: "Lead hook may be telegraphed by an early elbow flare",
                        description: (ctx) => {
                            const widest = [...strikesIn(ctx, { type: "hook", limb: "left_arm" })].sort((a, b) => b.jointAngleDeg - a.jointAngleDeg).slice(0, 4);
                            return `On the widest lead hooks the elbow opens to about ${meanOf(widest, "jointAngleDeg", 0)}° before the punch turns over, which may signal it early. The diagonal camera angle limits how precisely this can be measured.`;
                        },
                        confidence: 0.57,
                        evidence: { from: "detections", type: "hook", limb: "left_arm", rankBy: "jointAngleDeg", limit: 4 },
                        metric: (ctx) => ({
                            label: "Average lead-hook elbow angle",
                            value: meanOf(strikesIn(ctx, { type: "hook", limb: "left_arm" }), "jointAngleDeg"),
                            unit: "°",
                            reference: "Typical range 85–115°",
                        }),
                        recommendation: "Review these clips together; if confirmed, shorten the hook by keeping the elbow in line with the fist on the first half of the arc.",
                        review: null,
                    },
                    crossExtensionFinding({ confidence: 0.88 }),
                    lowConfidenceHooksFinding({ confidence: 0.52 }),
                    kickRotationFinding("right_leg", { confidence: 0.81, reference: "Personal best 12.9 m/s" }),
                    speedFadeFinding({ confidence: 0.66 }),
                    headMovementFinding("improvement", { confidence: 0.74 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "minh-bag-today",
        fighterId: "f-minh-tran",
        uploadedById: "u-minh-tran",
        sessionId: "s-minh-bag-today",
        title: "Heavy bag — morning power rounds",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 240,
        uploadedAt: fromToday(0, 8, 14),
        fileStyle: "camera",
        notes: null,
        outcome: { status: "processing", workerId: "gpu-worker-03", stage: "pose_estimation", progressPct: 46 },
    },
    {
        key: "minh-shadow-9d",
        fighterId: "f-minh-tran",
        uploadedById: "u-minh-tran",
        sessionId: null,
        title: "Shadow boxing — evening footwork check",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 150,
        uploadedAt: daysAgo(9, 20, 5),
        fileStyle: "android",
        notes: "Extra rounds at home. Switch-step drill in the middle.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.71,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.muay_thai,
                tuning: { guardDropRates: { lead_hook: 0.4 }, hookElbowDeg: [88, 108], headMovesPerMin: 8, hookConfusionRate: 0.14, stanceWidthRatio: 1.12, pivotRate: 0.45 },
                summaryNote: "Front-on phone footage gave clear keypoints; hooks thrown at an angle carried the lowest confidence.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { review: confirmed("Same pattern we see on pads — the right glove drifts after the hook.") }),
                    crossExtensionFinding({ review: confirmed() }),
                    headMovementFinding("improvement", {
                        review: corrected("Head movement adequate for shadow work", "The drill was footwork-focused; this rate is fine for solo rounds."),
                    }),
                    lowConfidenceHooksFinding({ review: confirmed("Checked each one — see the detection corrections.") }),
                    {
                        category: "footwork",
                        impact: "concern",
                        title: "Stance may be narrowing during combinations",
                        description: (ctx) =>
                            `Estimated stance width averaged ${ctx.metrics.footwork.stanceWidthRatio}× shoulder width, below the typical 1.2–1.4× range for Muay Thai.`,
                        confidence: 0.63,
                        evidence: { from: "events", types: ["step_in", "step_out"], limit: 4 },
                        metric: (ctx) => ({ label: "Stance width", value: ctx.metrics.footwork.stanceWidthRatio, unit: "× shoulder width", reference: "Typical 1.2–1.4×" }),
                        recommendation: "Check stance width in a mirror between rounds; feet slightly wider than the shoulders.",
                        review: rejected("Narrow stance was deliberate — this was a switch-step drill."),
                    },
                    pivotFinding("strength", { review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(8, 10, 20),
                    rating: 4,
                    summary: "Clean session. The guard after the lead hook is still the priority — confirmed the drops. Cross and footwork look sharp.",
                },
            },
        },
    },
    {
        key: "minh-sparring-16d",
        fighterId: "f-minh-tran",
        uploadedById: RAFAEL,
        sessionId: "s-minh-sparring-16d",
        title: "Sparring — technical rounds",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 270,
        uploadedAt: daysAgo(16, 20, 40),
        fileStyle: "camera",
        notes: "4 × 3 min at 60–70%. Partner in the blue gloves.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 1.12,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.muay_thai,
                tuning: {
                    confidenceShift: -0.04,
                    guardDropRates: { lead_hook: 0.5 },
                    hookConfusionRate: 0.22,
                    lowConfidenceRate: 0.08,
                    trackingLosses: 7,
                    trackingQuality: 0.83,
                    hookElbowDeg: [90, 112],
                    restSec: [2.0, 4.6],
                },
                summaryNote: "Two fighters were in frame, so partner occlusion lowered tracking and several detections carry low confidence.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { confidence: 0.7, review: confirmed("The partner landed the counter right hand twice off this.") }),
                    lowConfidenceHooksFinding({
                        confidence: 0.48,
                        review: corrected("Mixed hooks and crosses", "About half of these were crosses thrown on an angle — corrected individually."),
                    }),
                    jabRangeFinding({ confidence: 0.72, review: confirmed() }),
                    headMovementFinding("improvement", { review: confirmed() }),
                    trackingGapFinding("mostly when the partner stepped between Minh and the camera", confirmed("Noted — moving the camera to the corner post.")),
                    kickRotationFinding("right_leg", { confidence: 0.7, review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(15, 9, 30),
                    rating: 3,
                    summary: "Good pressure in rounds 1–2. The guard after the hook is the recurring issue; several AI hook labels were crosses — corrected.",
                },
            },
        },
    },
    {
        key: "kenji-bag-9d",
        fighterId: "f-kenji-morita",
        uploadedById: RAFAEL,
        sessionId: "s-kenji-bag-9d",
        title: "Heavy bag — speed and switch drills",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(9, 18, 32),
        fileStyle: "camera",
        notes: null,
        earlierFailure: {
            code: "WORKER_TIMEOUT",
            message: "Worker exceeded 300 s limit on frame 8,412",
            stage: "pose_estimation",
            progressPct: 52,
            workerId: "gpu-worker-04",
            runSec: 300,
            attempts: 1,
            retryAfterMin: 38,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.88,
            attempts: 1,
            analysis: {
                repertoire: emphasise(REPERTOIRES.karate, "teep", 1.5),
                tuning: { handSpeedFactor: 1.02, kickSpeedFactor: 1.03, headMovesPerMin: 3, southpawShare: 0.2, balanceScore: 89 },
                summaryNote: "The side-on camera gave a clear view of shoulder and hip mechanics; kick detections were the most confident.",
                findings: [
                    {
                        category: "cross",
                        impact: "concern",
                        title: "Right shoulder appears to rise at the peak of the cross",
                        description:
                            "On orthodox crosses the right shoulder appears to lift toward the ear at full extension rather than staying level, more often in the later rounds.",
                        confidence: 0.8,
                        evidence: { from: "detections", type: "cross", limb: "right_arm", rankBy: "jointAngleDeg", limit: 5 },
                        metric: (ctx) => ({
                            label: "Average right-cross extension",
                            value: meanOf(strikesIn(ctx, { type: "cross", limb: "right_arm" }), "jointAngleDeg"),
                            unit: "°",
                            reference: "Target 155–175°",
                        }),
                        recommendation: "Share with the sports doctor before loading the cross further; keep the rear shoulder relaxed and level on shadow reps meanwhile.",
                        review: confirmed("Visible on replay. Flagged to Dr. Thu Lê; intensity capped until the exam."),
                    },
                    teepFinding(confirmed()),
                    stanceSwitchFinding(confirmed()),
                    lowConfidenceHooksFinding({ review: corrected("Uraken (backfist)", "Two of these were backfists from the karate drill, not hooks.") }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    speedFadeFinding({ review: rejected("The last rounds were deliberately technical at a lower pace.") }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(8, 9, 0),
                    rating: 4,
                    summary: "Strong session. Agree with the shoulder flag on the cross — passed it to Dr. Thu Lê and capped intensity until the exam.",
                },
            },
        },
    },
    {
        key: "lucas-shadow-4d",
        fighterId: "f-lucas-ferreira",
        uploadedById: "u-lucas-ferreira",
        sessionId: null,
        title: "Rehab shadow boxing — light movement, no kicks",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 120,
        uploadedAt: daysAgo(4, 11, 20),
        fileStyle: "iphone",
        notes: "Light rounds from the rehab plan, RPE about 5. No kicks.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.66,
            attempts: 1,
            analysis: {
                repertoire: withoutMoves(REPERTOIRES.grappler, ["rear_kick"]),
                tuning: {
                    handSpeedFactor: 0.84,
                    restSec: [2.4, 4.4],
                    headMovesPerMin: 5,
                    pivotRate: 0.15,
                    stanceWidthRatio: 1.18,
                    balanceScore: 76,
                    trackingLosses: 0,
                },
                summaryNote: "Footage was well lit with the fighter in frame throughout; no kicks were detected.",
                findings: [
                    {
                        category: "footwork",
                        impact: "concern",
                        title: "Stride may be shorter when stepping off the left leg",
                        description:
                            "Steps in and out appear shorter on the left side, and hip extension looks reduced compared with earlier footage. Compare with the rehab plan before changing footwork drills.",
                        confidence: 0.74,
                        evidence: { from: "events", types: ["step_in", "step_out"], limit: 5 },
                        metric: (ctx) => {
                            const baseline = baselineOf("lucas-sparring-35d");
                            const perMin = (c: FindingContext) => round(c.metrics.footwork.distanceM / (c.durationMs / 60_000), 1);
                            return {
                                label: "Footwork distance per minute",
                                value: perMin(ctx),
                                unit: "m/min",
                                reference: baseline ? `Pre-injury sparring: ${perMin(baseline)} m/min` : null,
                            };
                        },
                        recommendation: "Share the clip with the physiotherapist; keep steps short and controlled until the next rehab milestone.",
                        review: null,
                    },
                    {
                        category: "movement_quality",
                        impact: "strength",
                        title: "Output kept at a light, controlled intensity",
                        description: (ctx) =>
                            `Punch speed averaged ${meanOf(ctx.detections, "peakSpeed")} m/s at ${ctx.metrics.strikesPerMin} strikes per minute, with no kicks detected.`,
                        confidence: 0.83,
                        evidence: { from: "combinations", limit: 3 },
                        metric: (ctx) => {
                            const baseline = baselineOf("lucas-sparring-35d");
                            return {
                                label: "Strikes per minute",
                                value: ctx.metrics.strikesPerMin,
                                unit: "/min",
                                reference: baseline ? `Pre-injury sparring: ${baseline.metrics.strikesPerMin}/min` : null,
                            };
                        },
                        recommendation: "Keep this intensity until the clearance allows more; film the same drill weekly to compare.",
                        review: null,
                    },
                    crossExtensionFinding({ confidence: 0.8 }),
                    guardUptimeFinding("strength"),
                    headMovementFinding("improvement"),
                ],
                review: null,
            },
        },
    },
    {
        key: "marcus-bag-11d",
        fighterId: "f-marcus-hale",
        uploadedById: RAFAEL,
        sessionId: "s-marcus-bag-11d",
        title: "Heavy bag — power rounds (stopped in round 4)",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 226,
        uploadedAt: daysAgo(11, 19, 10),
        fileStyle: "camera",
        notes: "Session stopped in round 4 after Marcus hurt his right hand on a cross.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.97,
            attempts: 2,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: {
                    handSpeedFactor: 1.05,
                    kickSpeedFactor: 1.02,
                    guardDropRates: { lead_hook: 0.1 },
                    incident: { kind: "rear_hand_impact", atSec: 204 },
                },
                summaryNote: "Rear-hand strikes stop after one cross in the final round and only lead-hand strikes follow until the clip ends.",
                findings: [
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Rear-hand strikes stop abruptly late in the clip",
                        description:
                            "After one cross in the final round the right hand is withdrawn and held low, and only lead-hand strikes follow until the clip ends. Review this moment with the fighter.",
                        confidence: 0.78,
                        evidence: { from: "events", types: ["guard_drop"], detail: "withdrawn", limit: 1 },
                        metric: (ctx) => {
                            const moment = ctx.events.find((e) => e.type === "guard_drop" && e.detail.includes("withdrawn"));
                            const rightHand = strikesIn(ctx, { limb: "right_arm" });
                            const after = moment ? rightHand.filter((d) => d.startMs > moment.startMs).length : 0;
                            return { label: "Right-hand strikes after that moment", value: after, unit: "strikes", reference: `${rightHand.length - after} earlier in the clip` };
                        },
                        recommendation: "Check in with the fighter and the sports doctor before any further bag work with the rear hand.",
                        review: confirmed("Hand injury — session stopped. Dr. Thu Lê informed."),
                    },
                    {
                        category: "cross",
                        impact: "strength",
                        title: "Cross speed appears high before the final round",
                        description: (ctx) =>
                            `Crosses averaged ${meanOf(strikesIn(ctx, { type: "cross", window: [0, 0.85] }), "peakSpeed")} m/s peak hand speed before the last round.`,
                        confidence: 0.86,
                        evidence: { from: "detections", type: "cross", window: [0, 0.85], rankBy: "peakSpeed", limit: 4 },
                        metric: (ctx) => {
                            const baseline = baselineOf("marcus-pads-22d");
                            return {
                                label: "Average cross speed",
                                value: meanOf(strikesIn(ctx, { type: "cross", window: [0, 0.85] }), "peakSpeed"),
                                unit: "m/s",
                                reference: baseline ? `Pad session 22 days ago: ${baseline.metrics.avgPeakSpeed.cross} m/s` : null,
                            };
                        },
                        recommendation: "Once cleared, rebuild rear-hand power gradually with wraps checked before every bag session.",
                        review: confirmed(),
                    },
                    kickRotationFinding("right_leg", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Head movement isn't the focus on power rounds.") }),
                    lowConfidenceHooksFinding({ review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(10, 8, 45),
                    rating: 3,
                    summary: "Power was excellent until the hand injury in round 4 — stopped the session. Confirmed the AI flag; Dr. Thu Lê has the details.",
                },
            },
        },
    },
    {
        key: "diego-sparring-6d",
        fighterId: "f-diego-alvarez",
        uploadedById: RAFAEL,
        sessionId: "s-diego-sparring-6d",
        title: "Sparring — MMA rounds (stopped in round 3)",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 204,
        uploadedAt: daysAgo(6, 19, 45),
        fileStyle: "camera",
        notes: "Round 3 stopped by the coach after a heavy exchange.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 1.18,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: {
                    roundLengthSec: 80,
                    restSec: [2.4, 5.2],
                    handSpeedFactor: 0.97,
                    confidenceShift: -0.15,
                    hookConfusionRate: 0.3,
                    lowConfidenceRate: 0.26,
                    trackingLosses: 9,
                    trackingQuality: 0.76,
                    headMovesPerMin: 7,
                    balanceScore: 78,
                    incident: { kind: "unsteady_after_exchange", atSec: 176 },
                },
                summaryNote: "Frequent occlusion by the sparring partner lowered overall confidence, so detections and metrics should be read with caution.",
                findings: [
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Guard recovery appears delayed after an exchange late in the clip",
                        description: (ctx) =>
                            `After an exchange in the final round the guard takes about ${guardRecoveryAfter(ctx, "exchange")} ms to return, and the following steps appear unsteady with a narrower base.`,
                        confidence: 0.61,
                        evidence: { from: "events", types: ["guard_drop", "lateral_step"], window: [0.84, 1], limit: 5 },
                        metric: (ctx) => {
                            const earlier = ctx.events.filter((e) => e.type === "guard_drop" && e.endMs < ctx.durationMs * 0.84);
                            return {
                                label: "Guard recovery after the exchange",
                                value: guardRecoveryAfter(ctx, "exchange"),
                                unit: "ms",
                                reference: `Earlier in the clip: ${Math.round(average(earlier.map((e) => e.endMs - e.startMs)))} ms`,
                            };
                        },
                        recommendation: "Review this moment with the coaching and medical team before the next contact session.",
                        review: null,
                    },
                    trackingGapFinding("mostly when the partner stepped between Diego and the camera"),
                    {
                        category: "footwork",
                        impact: "concern",
                        title: "Stance may narrow after the exchange",
                        description: (ctx) =>
                            `Balance was estimated at ${ctx.metrics.footwork.balanceScore}/100, with ${ctx.events.filter((e) => e.detail.startsWith("Unsteady")).length} unsteady lateral steps in the final part of the clip.`,
                        confidence: 0.58,
                        evidence: { from: "events", types: ["lateral_step"], detail: "Unsteady", limit: 4 },
                        metric: (ctx) => {
                            const baseline = baselineOf("diego-bag-42d");
                            return {
                                label: "Balance score",
                                value: ctx.metrics.footwork.balanceScore,
                                unit: "/100",
                                reference: baseline ? `Bag session 42 days ago: ${baseline.metrics.footwork.balanceScore}/100` : null,
                            };
                        },
                        recommendation: "Discuss this clip with the coaching and medical team before planning further sparring.",
                        review: null,
                    },
                    jabRangeFinding({ confidence: 0.63 }),
                    lowConfidenceHooksFinding({ confidence: 0.47 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "aigerim-pads-3d",
        fighterId: "f-aigerim-sadykova",
        uploadedById: RAFAEL,
        sessionId: "s-aigerim-pads-3d",
        title: "Pad work — defence and counters",
        trainingType: "pad_work",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 210,
        uploadedAt: daysAgo(3, 18, 5),
        fileStyle: "camera",
        notes: "Slip–counter rounds for the Hoshino game plan.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.9,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.boxing,
                tuning: {
                    roundLengthSec: 70,
                    restSec: [1.5, 3.0],
                    handSpeedFactor: 0.92,
                    headMovesPerMin: 16,
                    restGuardLapse: 0.06,
                    pivotRate: 0.5,
                    stanceWidthRatio: 1.24,
                    balanceScore: 91,
                },
                summaryNote: "Tracking was stable and head movement events were detected with high confidence.",
                findings: [
                    headMovementFinding("strength", { confidence: 0.9 }),
                    {
                        category: "head_movement",
                        impact: "strength",
                        title: "Counters appear to follow slips quickly",
                        description: (ctx) =>
                            `${countersOffHeadMovement(ctx)} of ${ctx.combinations.length} combinations started within a second of a slip or roll.`,
                        confidence: 0.81,
                        evidence: { from: "events", types: ["slip", "roll"], limit: 4 },
                        metric: (ctx) => ({ label: "Combinations off head movement", value: countersOffHeadMovement(ctx), unit: "combinations", reference: `${ctx.combinations.length} combinations in total` }),
                        recommendation: "Keep the counter tight to the slip; add a second counter after the first to extend the exchange.",
                        review: null,
                    },
                    guardUptimeFinding("strength"),
                    pivotFinding("strength"),
                    jabRangeFinding(),
                    lowConfidenceHooksFinding({ confidence: 0.55 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "linh-bag-5d",
        fighterId: "f-linh-pham",
        uploadedById: "u-linh-pham",
        sessionId: "s-linh-bag-5d",
        title: "Heavy bag — kick volume rounds",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 180,
        uploadedAt: daysAgo(5, 18, 40),
        fileStyle: "android",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.74,
            attempts: 1,
            analysis: {
                repertoire: LINH_KICK_ROUNDS,
                tuning: { handSpeedFactor: 0.84, kickSpeedFactor: 1.03, guardDropRates: { rear_kick: 0.35 } },
                summaryNote: "Kick detections were consistently confident; punches made up a small share of the output.",
                findings: [
                    kickRotationFinding("left_leg", { confidence: 0.88, reference: "Flyweight team avg 10.9 m/s", review: confirmed("Best kicks in the amateur group.") }),
                    {
                        category: "combination",
                        impact: "improvement",
                        title: "Hands appear to lag behind kicks",
                        description: (ctx) => {
                            const punches = ctx.detections.filter((d) => d.type !== "kick");
                            return `Punches made up ${Math.round((punches.length / ctx.detections.length) * 100)}% of strikes and averaged ${meanOf(punches, "peakSpeed")} m/s, while kicks averaged ${ctx.metrics.avgPeakSpeed.kick} m/s.`;
                        },
                        confidence: 0.79,
                        evidence: { from: "combinations", labelPrefix: "Jab", limit: 4 },
                        metric: (ctx) => ({
                            label: "Punch share of strikes",
                            value: Math.round((ctx.detections.filter((d) => d.type !== "kick").length / ctx.detections.length) * 100),
                            unit: "%",
                            reference: "Kickboxing team avg 68%",
                        }),
                        recommendation: "Add two boxing-only bag rounds per session and build jab–cross volume before the kicks.",
                        review: confirmed("Agreed — adding boxing rounds from this week."),
                    },
                    kickGuardFinding("left_leg", { review: corrected("Arm swing within normal range", "Natural counterbalance on the kick — only an issue at close range.") }),
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Knee may move inward on some kick landings",
                        description:
                            "On a few rear-kick landings the left knee appears to move inward as the foot returns to stance. Side-on footage limits how precisely this can be judged.",
                        confidence: 0.58,
                        evidence: { from: "detections", type: "kick", limb: "left_leg", rankBy: "peakSpeed", limit: 3 },
                        metric: (ctx) => ({ label: "Kicks with possible inward knee movement", value: 3, unit: "kicks", reference: `${strikesIn(ctx, { type: "kick", limb: "left_leg" }).length} rear kicks in total` }),
                        recommendation: "Refer to the sports doctor's review of the matching movement observation before changing technique.",
                        review: rejected("Dr. Thu Lê reviewed the matching alert — within normal landing mechanics."),
                    },
                    teepFinding(confirmed()),
                    speedFadeFinding({ review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(4, 9, 10),
                    rating: 4,
                    summary: "Kicks are the standout — speed and rotation both excellent. Hands need volume; adding boxing rounds. Knee flag reviewed by Dr. Thu Lê and dismissed.",
                },
            },
        },
    },
    {
        key: "emma-sparring-1d",
        fighterId: "f-emma-lindqvist",
        uploadedById: RAFAEL,
        sessionId: "s-emma-sparring-1d",
        title: "Sparring — kickboxing rounds",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 300,
        uploadedAt: daysAgo(1, 21, 40),
        fileStyle: "camera",
        notes: null,
        outcome: { status: "queued" },
    },
    {
        key: "sofia-pads-8d",
        fighterId: "f-sofia-kowalski",
        uploadedById: ANNA,
        sessionId: "s-sofia-pads-8d",
        title: "Pad work — striking entries to the clinch",
        trainingType: "pad_work",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 165,
        uploadedAt: daysAgo(8, 12, 5),
        fileStyle: "camera",
        notes: "Re-uploaded after the first file was cut off mid-transfer.",
        earlierFailure: {
            code: "CORRUPT_CONTAINER",
            message: "moov atom not found — the upload appears to be truncated",
            stage: "decoding",
            progressPct: 3,
            workerId: "gpu-worker-03",
            runSec: 6,
            attempts: 1,
            retryAfterMin: 24,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.69,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { roundLengthSec: 55, restSec: [1.8, 3.8], handSpeedFactor: 0.88, headMovesPerMin: 5, straightExtensionShift: -12, stanceWidthRatio: 1.34, balanceScore: 90 },
                summaryNote: "Front-on footage kept the fighter in frame; the pad holder briefly blocked the view on entries.",
                findings: [
                    jabRangeFinding({ review: confirmed("The jab is her entry to the clinch — exactly what we drill.") }),
                    {
                        category: "footwork",
                        impact: "strength",
                        title: "Steps in appear to follow the jab closely",
                        description: (ctx) => `${ctx.events.filter((e) => e.type === "step_in").length} steps in to range were detected, most immediately before a combination.`,
                        confidence: 0.8,
                        evidence: { from: "events", types: ["step_in"], limit: 4 },
                        metric: (ctx) => ({ label: "Steps in to range", value: ctx.events.filter((e) => e.type === "step_in").length, unit: "steps", reference: null }),
                        recommendation: "Finish each entry with an underhook or collar tie so the strikes lead straight into the clinch.",
                        review: confirmed(),
                    },
                    {
                        category: "cross",
                        impact: "improvement",
                        title: "Cross may be falling short of full extension",
                        description: (ctx) => `Straight punches averaged ${ctx.metrics.avgPunchExtensionDeg}° of elbow extension, below the usual 155–175° target.`,
                        confidence: 0.71,
                        evidence: { from: "detections", type: "cross", rankBy: "jointAngleDeg", rank: "lowest", limit: 4 },
                        metric: (ctx) => ({ label: "Average straight-punch extension", value: ctx.metrics.avgPunchExtensionDeg, unit: "°", reference: "Target 155–175°" }),
                        recommendation: "If reach matters for the game plan, add long-range cross reps on pads.",
                        review: corrected("Short cross by design", "She throws the cross to close distance for the clinch, not to land at full extension."),
                    },
                    guardUptimeFinding("strength", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Not a focus for her game plan this camp.") }),
                ],
                review: {
                    reviewerId: ANNA,
                    reviewedAt: daysAgo(7, 9, 40),
                    rating: 4,
                    summary: "Good entries off the jab for the clinch game. Cross is short by design. Solid pre-fight session.",
                },
            },
        },
    },
    {
        key: "hoang-shadow-7d",
        fighterId: "f-hoang-long",
        uploadedById: "u-hoang-long",
        sessionId: "s-hoang-shadow-7d",
        title: "Shadow boxing — early morning session",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 150,
        uploadedAt: daysAgo(7, 8, 30),
        fileStyle: "android",
        notes: "Filmed before the gym lights were switched on.",
        earlierFailure: {
            code: "GPU_WORKER_LOST",
            message: "Lost heartbeat from gpu-worker-04 during tracking (node preempted)",
            stage: "tracking",
            progressPct: 31,
            workerId: "gpu-worker-04",
            runSec: 71,
            attempts: 1,
            retryAfterMin: 12,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.82,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.karate,
                tuning: {
                    handSpeedFactor: 0.95,
                    kickSpeedFactor: 0.97,
                    confidenceShift: -0.31,
                    lowConfidenceRate: 0.1,
                    hookConfusionRate: 0.25,
                    trackingLosses: 5,
                    trackingLossDetail: "Low light — keypoints could not be estimated",
                    trackingQuality: 0.8,
                    rearHipRotationFactor: 0.74,
                },
                summaryNote: "Poor lighting reduced keypoint quality, so overall confidence is low and most outputs should be reviewed before use.",
                findings: [
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Rear-hand strikes appear to rotate less than in earlier footage",
                        description: (ctx) => {
                            const baseline = baselineOf("hoang-pads-30d");
                            const current = meanOf(strikesIn(ctx, { type: "cross" }), "hipRotationDeg");
                            const earlier = baseline ? meanOf(strikesIn(baseline, { type: "cross" }), "hipRotationDeg") : null;
                            return `Crosses averaged ${current}° of hip rotation${earlier === null ? "" : `, compared with ${earlier}° in the pad session filmed 30 days ago`}. Low lighting reduces the precision of this estimate.`;
                        },
                        confidence: 0.62,
                        evidence: { from: "detections", type: "cross", rankBy: "hipRotationDeg", rank: "lowest", limit: 4 },
                        metric: (ctx) => {
                            const baseline = baselineOf("hoang-pads-30d");
                            return {
                                label: "Hip rotation on crosses",
                                value: meanOf(strikesIn(ctx, { type: "cross" }), "hipRotationDeg"),
                                unit: "°",
                                reference: baseline ? `Pad session 30 days ago: ${meanOf(strikesIn(baseline, { type: "cross" }), "hipRotationDeg")}°` : null,
                            };
                        },
                        recommendation: "Compare with a well-lit recording before drawing conclusions, and mention any back tightness to the sports doctor.",
                        review: null,
                    },
                    {
                        category: "movement_quality",
                        impact: "improvement",
                        title: "Low lighting reduced detection confidence",
                        description: (ctx) => {
                            const low = ctx.detections.filter((d) => d.confidence < LOW_CONFIDENCE_THRESHOLD).length;
                            return `Mean detection confidence was ${Math.round(meanOf(ctx.detections, "confidence", 2) * 100)}%, and ${low} of ${ctx.detections.length} strikes fell below the 60% review threshold.`;
                        },
                        confidence: 0.93,
                        evidence: { from: "detections", lowConfidence: true, limit: 5 },
                        metric: (ctx) => ({
                            label: "Strikes below 60% confidence",
                            value: Math.round((ctx.detections.filter((d) => d.confidence < LOW_CONFIDENCE_THRESHOLD).length / ctx.detections.length) * 100),
                            unit: "%",
                            reference: "Typical shadow boxing: under 5%",
                        }),
                        recommendation: "Re-record with the gym lights on and the camera at chest height, 3–4 m away.",
                        review: null,
                    },
                    trackingGapFinding("in the darkest corner of the room"),
                    kickRotationFinding("right_leg", { confidence: 0.56 }),
                    lowConfidenceHooksFinding({ confidence: 0.45 }),
                    headMovementFinding("improvement", { confidence: 0.58 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "tariq-shadow-2d",
        fighterId: "f-tariq-haddad",
        uploadedById: "u-tariq-haddad",
        sessionId: null,
        title: "Shadow boxing — footwork after knee rehab",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 95,
        uploadedAt: daysAgo(2, 10, 15),
        fileStyle: "iphone",
        notes: "Phone propped on the bench.",
        outcome: {
            status: "failed",
            failure: {
                code: "NO_FIGHTER_DETECTED",
                message: "Fighter detected in only 11% of sampled frames (minimum 60%) — the subject was out of frame for most of the clip.",
                stage: "fighter_detection",
                progressPct: 18,
                workerId: "gpu-worker-02",
                runSec: 24,
                attempts: 1,
            },
        },
    },
    {
        key: "bao-shadow-3d",
        fighterId: "f-bao-nguyen",
        uploadedById: "u-bao-nguyen",
        sessionId: null,
        title: "First shadow boxing upload",
        trainingType: "shadow_boxing",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 140,
        uploadedAt: daysAgo(3, 20, 50),
        fileStyle: "iphone",
        notes: null,
        outcome: {
            status: "failed",
            failure: {
                code: "UNSUPPORTED_CODEC",
                message: "HEVC Main 10 (10-bit) video is not supported by the decoder. Re-export as H.264 (8-bit) and upload again.",
                stage: "decoding",
                progressPct: 2,
                workerId: "gpu-worker-04",
                runSec: 4,
                attempts: 2,
            },
        },
    },
    /* Older completed & reviewed footage */
    {
        key: "emma-bag-12d",
        fighterId: "f-emma-lindqvist",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Heavy bag — 4K test recording",
        trainingType: "heavy_bag",
        cameraAngle: "diagonal",
        resolution: "3840x2160",
        fps: 60,
        durationSec: 150,
        uploadedAt: daysAgo(12, 17, 50),
        fileStyle: "camera",
        notes: "Testing the new 4K camera.",
        earlierFailure: {
            code: "OUT_OF_MEMORY",
            message: "CUDA out of memory: tried to allocate 2.34 GiB (GPU 0; 23.99 GiB total) in the pose batch for 3840x2160 @ 60 fps input",
            stage: "pose_estimation",
            progressPct: 44,
            workerId: "gpu-worker-01",
            runSec: 96,
            attempts: 1,
            retryAfterMin: 55,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 1.2,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: { handSpeedFactor: 1.04 * 0.92, kickSpeedFactor: 1.06 * 0.92, restGuardLapse: 0.08, balanceScore: 90, trackingQuality: 0.96 },
                summaryNote: "High-resolution footage produced very stable keypoints throughout.",
                findings: [
                    kickRotationFinding("left_leg", { review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Bag rounds were about power — head movement wasn't the drill.") }),
                    lowConfidenceHooksFinding({ review: confirmed() }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(11, 9, 15), rating: 5, summary: "Excellent session — speed held all the way through. Nothing major to fix." },
            },
        },
    },
    {
        key: "aigerim-shadow-13d",
        fighterId: "f-aigerim-sadykova",
        uploadedById: "u-aigerim-sadykova",
        sessionId: null,
        title: "Shadow boxing — slip and pivot rounds",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 120,
        uploadedAt: daysAgo(13, 19, 20),
        fileStyle: "iphone",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.63,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.boxing,
                tuning: { handSpeedFactor: 0.9, headMovesPerMin: 15, pivotRate: 0.45, restGuardLapse: 0.06, balanceScore: 92 },
                summaryNote: "Clear front-on footage; head movement and pivots were detected with high confidence.",
                findings: [
                    headMovementFinding("strength", { review: confirmed("Best on the team.") }),
                    pivotFinding("strength", { review: confirmed() }),
                    jabRangeFinding({ review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    crossExtensionFinding({ review: corrected("Good extension, shortens under fatigue", "Extension drops a little in the last minute — worth watching.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(12, 10, 0), rating: 5, summary: "Head movement outstanding as always. Keep it." },
            },
        },
    },
    {
        key: "tariq-bag-13d",
        fighterId: "f-tariq-haddad",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Heavy bag — controlled boxing rounds",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(13, 16, 45),
        fileStyle: "camera",
        notes: "No kicks, limited pivots — knee return-to-training phase.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.86,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.boxing,
                tuning: { handSpeedFactor: 0.9, pivotRate: 0.12, guardDropRates: { lead_hook: 0.3 }, stanceWidthRatio: 1.36, balanceScore: 82 },
                summaryNote: "Side-on footage gave clear punch mechanics; no kicks were detected.",
                findings: [
                    jabRangeFinding({ review: confirmed() }),
                    guardAfterLeadHookFinding("left_arm", { review: confirmed() }),
                    pivotFinding("improvement", { review: corrected("Pivots limited by rehab plan", "Knee return-to-training phase — we are deliberately limiting pivots.") }),
                    crossExtensionFinding({ review: confirmed() }),
                    speedFadeFinding({ review: rejected("Planned drop in intensity — the last round was technical.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(12, 11, 5), rating: 4, summary: "Good controlled power, footwork respecting the knee. Jab excellent. Watch the hook guard." },
            },
        },
    },
    {
        key: "linh-pads-18d",
        fighterId: "f-linh-pham",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Pad work — kick combinations",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 200,
        uploadedAt: daysAgo(18, 18, 20),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.92,
            attempts: 2,
            analysis: {
                repertoire: emphasise(REPERTOIRES.kickboxing, "rear_kick", 1.6),
                tuning: { handSpeedFactor: 0.85, kickSpeedFactor: 1.02, guardDropRates: { jab: 0.15, cross: 0.18, rear_kick: 0.45 }, restGuardLapse: 0.32 },
                summaryNote: "Kick detections were confident; the pad holder occasionally blocked the view of the hands.",
                findings: [
                    kickRotationFinding("left_leg", { review: confirmed() }),
                    kickGuardFinding("left_leg", { review: confirmed() }),
                    guardUptimeFinding("concern", { review: confirmed("Hands return slowly after straight punches.") }),
                    crossExtensionFinding({ review: corrected("Cross extension adequate", "Reach is fine; hand speed is the issue.") }),
                    headMovementFinding("improvement", { review: confirmed() }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(17, 9, 0), rating: 4, summary: "Kicks sharp. Hands still slow to return to the guard." },
            },
        },
    },
    {
        key: "kenji-shadow-20d",
        fighterId: "f-kenji-morita",
        uploadedById: "u-kenji-morita",
        sessionId: null,
        title: "Shadow boxing — karate footwork",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 140,
        uploadedAt: daysAgo(20, 7, 50),
        fileStyle: "android",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.7,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.karate,
                tuning: { southpawShare: 0.35, handSpeedFactor: 1.02, kickSpeedFactor: 1.04, headMovesPerMin: 7, balanceScore: 90 },
                summaryNote: "Clear footage with stable tracking; stance switches were tracked reliably.",
                findings: [
                    stanceSwitchFinding(confirmed()),
                    teepFinding(confirmed()),
                    crossExtensionFinding({ review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Karate-style distance management rather than slips.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(19, 10, 15), rating: 4, summary: "Sharp footwork and switching. Nothing unusual in the shoulder at this point." },
            },
        },
    },
    {
        key: "emma-pads-20d",
        fighterId: "f-emma-lindqvist",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Pad work — southpaw kick setups",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(20, 17, 30),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.85,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: { handSpeedFactor: 1.03 * 0.92, kickSpeedFactor: 1.05 * 0.92, guardDropRates: { lead_hook: 0.33 }, hookConfusionRate: 0.12 },
                summaryNote: "Tracking was stable; a few hooks thrown across the camera were classified with low confidence.",
                findings: [
                    guardAfterLeadHookFinding("right_arm", { review: confirmed() }),
                    kickRotationFinding("left_leg", { review: confirmed() }),
                    jabRangeFinding({ review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    lowConfidenceHooksFinding({ review: corrected("Mixed hooks and crosses", "A couple were crosses — corrected on the detections.") }),
                    headMovementFinding("improvement", { review: confirmed("Slip after the kick, not just after punches.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(19, 9, 0), rating: 4, summary: "Crisp work. Tighten the guard on the lead hook slightly." },
            },
        },
    },
    {
        key: "marcus-pads-22d",
        fighterId: "f-marcus-hale",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Pad work — power combinations",
        trainingType: "pad_work",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 210,
        uploadedAt: daysAgo(22, 16, 40),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.9,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: { handSpeedFactor: 1.05, kickSpeedFactor: 1.02, guardDropRates: { rear_kick: 0.32 }, stanceWidthRatio: 1.32 },
                summaryNote: "Front-on footage gave clear punch extension; kicks toward the camera were slightly less confident.",
                findings: [
                    crossExtensionFinding({ review: confirmed() }),
                    kickRotationFinding("right_leg", { review: confirmed() }),
                    kickGuardFinding("right_leg", { review: corrected("Arm swing acceptable", "Counterbalance arm — only an issue in the pocket.") }),
                    speedFadeFinding({ review: confirmed() }),
                    headMovementFinding("improvement", { review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(21, 9, 30),
                    rating: 4,
                    summary: "Heavy hands and good kick rhythm. The rear hand is his weapon — keep the wrist straight on impact.",
                },
            },
        },
    },
    {
        key: "sofia-shadow-26d",
        fighterId: "f-sofia-kowalski",
        uploadedById: "u-sofia-kowalski",
        sessionId: null,
        title: "Shadow boxing — conditioning finisher",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 110,
        uploadedAt: daysAgo(26, 19, 0),
        fileStyle: "android",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.64,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { handSpeedFactor: 0.87, straightExtensionShift: -10, guardDropRates: { cross: 0.3, jab: 0.2 }, restGuardLapse: 0.3 },
                summaryNote: "Tracking was stable; guard drops increased in the second half of the clip.",
                findings: [
                    jabRangeFinding({ review: confirmed() }),
                    guardUptimeFinding("concern", { review: confirmed("Tired in the second half — the guard drops.") }),
                    headMovementFinding("improvement", { review: rejected("Not the focus of this finisher.") }),
                    speedFadeFinding({ review: confirmed() }),
                ],
                review: { reviewerId: ANNA, reviewedAt: daysAgo(25, 10, 0), rating: 3, summary: "Striking is a support tool for her — entries fine, guard lapses when she tires." },
            },
        },
    },
    {
        key: "hoang-pads-30d",
        fighterId: "f-hoang-long",
        uploadedById: ANNA,
        sessionId: null,
        title: "Pad work — Vovinam kicks and hands",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 160,
        uploadedAt: daysAgo(30, 17, 20),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.72,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.karate,
                tuning: { handSpeedFactor: 0.95, kickSpeedFactor: 0.98, trackingQuality: 0.94 },
                summaryNote: "Well-lit footage with stable tracking throughout.",
                findings: [
                    kickRotationFinding("right_leg", { review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    teepFinding(confirmed()),
                    headMovementFinding("improvement", { review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                ],
                review: { reviewerId: ANNA, reviewedAt: daysAgo(29, 9, 45), rating: 4, summary: "Good kicks and rotation. Fine session." },
            },
        },
    },
    {
        key: "lucas-sparring-35d",
        fighterId: "f-lucas-ferreira",
        uploadedById: ANNA,
        sessionId: null,
        title: "Sparring — MMA rounds",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 240,
        uploadedAt: daysAgo(35, 18, 30),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 1.1,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { handSpeedFactor: 0.95, trackingLosses: 8, trackingQuality: 0.8, confidenceShift: -0.03, restGuardLapse: 0.3, hookConfusionRate: 0.35 },
                summaryNote: "Clinch exchanges caused repeated occlusion, so some detections carry low confidence.",
                findings: [
                    jabRangeFinding({ review: confirmed() }),
                    trackingGapFinding("mostly during clinch exchanges", confirmed("Clinch exchanges — expected.")),
                    lowConfidenceHooksFinding({ review: corrected("Mostly crosses", "Most of these were crosses thrown from the clinch break.") }),
                    guardUptimeFinding("concern", { review: confirmed() }),
                    kickRotationFinding("left_leg", { review: confirmed() }),
                ],
                review: { reviewerId: ANNA, reviewedAt: daysAgo(34, 10, 0), rating: 3, summary: "Striking is fine for his level; he should shoot earlier. Tracking dropped whenever we clinched." },
            },
        },
    },
    {
        key: "diego-bag-42d",
        fighterId: "f-diego-alvarez",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Heavy bag — boxing fundamentals",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(42, 16, 10),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.88,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { handSpeedFactor: 0.97, hookElbowDeg: [98, 122], guardDropRates: { lead_hook: 0.3 }, pivotRate: 0.05, balanceScore: 88 },
                summaryNote: "Side-on footage gave clear punch mechanics with stable tracking.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { review: confirmed() }),
                    pivotFinding("improvement", { review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    jabRangeFinding({ review: corrected("Jab used sparingly", "He mostly led with the cross in this session.") }),
                    headMovementFinding("improvement", { review: confirmed("Needs to move his head off the line after punching.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(41, 9, 0), rating: 3, summary: "Honest work from a wrestler's base. Hooks are wide — keep drilling them tight." },
            },
        },
    },
];

/** Combinations that start within a second of a slip or roll ending. */
function countersOffHeadMovement(ctx: FindingContext): number {
    const moves = ctx.events.filter((e) => e.type === "slip" || e.type === "roll");
    return ctx.combinations.filter((c) => moves.some((m) => c.startMs - m.endMs >= 0 && c.startMs - m.endMs <= 1000)).length;
}

/* ─── Building videos, jobs and analyses ──────────────────────────────────── */

const TYPE_SLUG: Record<VideoTrainingType, string> = { shadow_boxing: "shadow", pad_work: "padwork", heavy_bag: "bag", sparring: "sparring" };
const CAMERA_NUMBER: Record<CameraAngle, number> = { front: 1, diagonal: 2, side: 3 };

const addSeconds = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString();

/**
 * Plans and pipeline timings are computed from authored times; stored records map the ones
 * that fall on today before the mock anchor (see time.ts), which keeps their order.
 */
const pastOrNull = (iso: string | null) => (iso === null ? null : clampPastToday(iso));

function pastJob(job: AIJob): AIJob {
    return { ...job, queuedAt: clampPastToday(job.queuedAt), startedAt: pastOrNull(job.startedAt), finishedAt: pastOrNull(job.finishedAt) };
}

function userName(userId: string): string {
    return mockUsers.find((u) => u.id === userId)?.name ?? "Unknown user";
}

function fighterOf(fighterId: string) {
    const fighter = mockFighters.find((f) => f.id === fighterId);
    if (!fighter) throw new Error(`Unknown fighter in AI seed: ${fighterId}`);
    return fighter;
}

function fileNameFor(plan: VideoPlan, second: number): string {
    const recordedAt = addSeconds(plan.uploadedAt, -35 * 60);
    const date = dayKey(recordedAt);
    const compactDate = date.replace(/-/g, "");
    const clock = `${formatTime(recordedAt).replace(":", "")}${String(second).padStart(2, "0")}`;
    if (plan.fileStyle === "android") return `PXL_${compactDate}_${clock}.mp4`;
    if (plan.fileStyle === "iphone") return `IMG_${compactDate}_${clock}.MOV`;
    const firstName = plan.key.split("-")[0];
    return `${date}_${firstName}_${TYPE_SLUG[plan.trainingType]}_cam${CAMERA_NUMBER[plan.cameraAngle]}.mp4`;
}

function megabytesPerMinute(plan: VideoPlan, rng: ReturnType<typeof createRandom>): number {
    if (plan.resolution === "3840x2160") return rng.float(150, 175, 1);
    if (plan.fps === 60) return rng.float(45, 60, 1);
    return rng.float(24, 32, 1);
}

function failedJob(id: string, plan: VideoPlan, failure: FailurePlan, queuedAt: string, waitSec: number): AIJob {
    const startedAt = addSeconds(queuedAt, waitSec);
    return {
        id,
        videoId: `v-${plan.key}`,
        fighterId: plan.fighterId,
        status: "failed",
        stage: failure.stage,
        progressPct: failure.progressPct,
        modelIds: PIPELINE_MODEL_IDS,
        workerId: failure.workerId,
        attempts: failure.attempts,
        queuedAt,
        startedAt,
        finishedAt: addSeconds(startedAt, failure.runSec),
        durationSec: failure.runSec,
        avgConfidence: null,
        lowConfidence: false,
        errorCode: failure.code,
        errorMessage: failure.message,
    };
}

function buildSeed(): { videos: Video[]; jobs: AIJob[]; analyses: AIAnalysis[] } {
    const videos: Video[] = [];
    const jobs: AIJob[] = [];
    const analyses: AIAnalysis[] = [];

    const chronological = [...VIDEO_PLANS].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
    for (const plan of chronological) {
        const rng = createRandom(`video:${plan.key}`);
        const fighter = fighterOf(plan.fighterId);
        const videoId = `v-${plan.key}`;
        const jobId = `job-${plan.key}`;
        const outcome = plan.outcome;

        let queuedAt = addSeconds(plan.uploadedAt, rng.int(3, 9));
        if (plan.earlierFailure) {
            const earlier = failedJob(`${jobId}-a1`, plan, plan.earlierFailure, queuedAt, rng.int(8, 40));
            jobs.push(pastJob(earlier));
            queuedAt = addSeconds(earlier.finishedAt ?? queuedAt, plan.earlierFailure.retryAfterMin * 60);
        }
        const waitSec = rng.int(8, 75);

        let job: AIJob;
        let analysisId: string | null = null;
        if (outcome.status === "completed") {
            const startedAt = addSeconds(queuedAt, waitSec);
            const durationSec = Math.round(plan.durationSec * outcome.processingRatio);
            const finishedAt = addSeconds(startedAt, durationSec);
            const plannedReview = outcome.analysis.review;
            const analysis = generateAnalysis({
                analysisId: `an-${plan.key}`,
                videoId,
                jobId,
                fighterId: plan.fighterId,
                trainingType: plan.trainingType,
                stance: fighter.stance,
                durationSec: plan.durationSec,
                fps: plan.fps,
                processedAt: clampPastToday(finishedAt),
                models: PRODUCTION_MODEL_VERSIONS,
                seed: `an-${plan.key}`,
                tuning: resolveTuning(plan.trainingType, outcome.analysis.repertoire, outcome.analysis.tuning),
                summaryNote: outcome.analysis.summaryNote,
                findings: outcome.analysis.findings,
                reviewer: plannedReview
                    ? { id: plannedReview.reviewerId, name: userName(plannedReview.reviewerId), reviewedAt: clampPastToday(plannedReview.reviewedAt) }
                    : null,
                coachReview: plannedReview ? { rating: plannedReview.rating, summary: plannedReview.summary } : null,
            });
            generated.set(plan.key, analysis);
            analyses.push(analysis);
            analysisId = analysis.id;
            job = {
                id: jobId,
                videoId,
                fighterId: plan.fighterId,
                status: "completed",
                stage: "done",
                progressPct: 100,
                modelIds: PIPELINE_MODEL_IDS,
                workerId: outcome.workerId,
                attempts: outcome.attempts,
                queuedAt,
                startedAt,
                finishedAt,
                durationSec,
                avgConfidence: analysis.overallConfidence,
                lowConfidence: analysis.overallConfidence < LOW_CONFIDENCE_THRESHOLD,
                errorCode: null,
                errorMessage: null,
            };
        } else if (outcome.status === "processing") {
            job = {
                id: jobId,
                videoId,
                fighterId: plan.fighterId,
                status: "processing",
                stage: outcome.stage,
                progressPct: outcome.progressPct,
                modelIds: PIPELINE_MODEL_IDS,
                workerId: outcome.workerId,
                attempts: 1,
                queuedAt,
                startedAt: addSeconds(queuedAt, waitSec),
                finishedAt: null,
                durationSec: null,
                avgConfidence: null,
                lowConfidence: false,
                errorCode: null,
                errorMessage: null,
            };
        } else if (outcome.status === "queued") {
            job = {
                id: jobId,
                videoId,
                fighterId: plan.fighterId,
                status: "queued",
                stage: "queued",
                progressPct: 0,
                modelIds: PIPELINE_MODEL_IDS,
                workerId: null,
                attempts: 1,
                queuedAt,
                startedAt: null,
                finishedAt: null,
                durationSec: null,
                avgConfidence: null,
                lowConfidence: false,
                errorCode: null,
                errorMessage: null,
            };
        } else {
            job = failedJob(jobId, plan, outcome.failure, queuedAt, waitSec);
        }
        jobs.push(pastJob(job));

        videos.push({
            id: videoId,
            fighterId: plan.fighterId,
            uploadedById: plan.uploadedById,
            sessionId: plan.sessionId,
            title: plan.title,
            trainingType: plan.trainingType,
            cameraAngle: plan.cameraAngle,
            fileName: fileNameFor(plan, rng.int(0, 59)),
            fileSizeMb: round((megabytesPerMinute(plan, rng) * plan.durationSec) / 60, 1),
            durationSec: plan.durationSec,
            resolution: plan.resolution,
            fps: plan.fps,
            uploadedAt: clampPastToday(plan.uploadedAt),
            status: outcome.status,
            jobId,
            analysisId,
            sourceUrl: null,
            notes: plan.notes,
        });
    }

    const newestFirst = <T>(items: T[], date: (item: T) => string) => items.sort((a, b) => date(b).localeCompare(date(a)));
    return {
        videos: newestFirst(videos, (v) => v.uploadedAt),
        jobs: newestFirst(jobs, (j) => j.queuedAt),
        analyses: newestFirst(analyses, (a) => a.processedAt),
    };
}

const seed = buildSeed();

export const mockVideos: Video[] = seed.videos;
export const mockAIJobs: AIJob[] = seed.jobs;
export const mockAIAnalyses: AIAnalysis[] = seed.analyses;

/* ─── Abnormal movement alerts ────────────────────────────────────────────── */

interface AlertPlan {
    id: string;
    key: string;
    bodyRegion: BodyRegion;
    pattern: string;
    description: string;
    confidence: number;
    metric: (analysis: AIAnalysis) => AbnormalMovementAlert["metric"];
    timestampsMs: (analysis: AIAnalysis) => number[];
    status: AlertStatus;
    review: { reviewerId: string; reviewedAt: string; note: string } | null;
    linkedInjuryId: string | null;
}

function analysisOf(key: string): AIAnalysis {
    const analysis = generated.get(key);
    if (!analysis) throw new Error(`Alert references a missing analysis: ${key}`);
    return analysis;
}

function ranked(detections: Detection[], field: "jointAngleDeg" | "hipRotationDeg" | "peakSpeed", count: number, order: "highest" | "lowest" = "highest"): Detection[] {
    return [...detections]
        .sort((a, b) => (order === "highest" ? b[field] - a[field] : a[field] - b[field]))
        .slice(0, count)
        .sort((a, b) => a.peakMs - b.peakMs);
}

const leftHooks = (analysis: AIAnalysis) => strikesIn(findingContext(analysis), { type: "hook", limb: "left_arm" });

const ALERT_PLANS: AlertPlan[] = [
    {
        id: "al-minh-elbow-2d",
        key: "minh-pads-2d",
        bodyRegion: "left_elbow",
        pattern: "Lead-arm elbow extension beyond his usual range on hooks",
        description:
            "On several lead hooks the left elbow appears to open wider than in Minh's earlier analysed footage. Movement observation for clinical context; the fighter reported no symptoms in the session notes.",
        confidence: 0.64,
        metric: (analysis) => ({
            label: "Lead-hook elbow angle at peak (widest hooks)",
            observed: meanOf(ranked(leftHooks(analysis), "jointAngleDeg", 3), "jointAngleDeg"),
            baseline: meanOf([...leftHooks(analysisOf("minh-shadow-9d")), ...leftHooks(analysisOf("minh-sparring-16d"))], "jointAngleDeg"),
            unit: "°",
        }),
        timestampsMs: (analysis) => ranked(leftHooks(analysis), "jointAngleDeg", 3).map((d) => d.peakMs),
        status: "new",
        review: null,
        linkedInjuryId: null,
    },
    {
        id: "al-kenji-shoulder-9d",
        key: "kenji-bag-9d",
        bodyRegion: "right_shoulder",
        pattern: "Right shoulder elevation asymmetry on the cross",
        description:
            "At the peak of right-hand crosses the right shoulder appears raised relative to the left, compared with Kenji's earlier shadow-boxing footage. The pattern is more frequent in later rounds.",
        confidence: 0.81,
        metric: () => ({ label: "Right shoulder elevation at cross peak", observed: 3.8, baseline: 1.4, unit: "cm" }),
        timestampsMs: (analysis) => ranked(strikesIn(findingContext(analysis), { type: "cross", limb: "right_arm" }), "jointAngleDeg", 4).map((d) => d.peakMs),
        status: "follow_up",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(8, 10, 30),
            note: "Elevation visible on replay. Shoulder examination booked for tomorrow; intensity capped at RPE 8 until then.",
        },
        linkedInjuryId: null,
    },
    {
        id: "al-lucas-hip-4d",
        key: "lucas-shadow-4d",
        bodyRegion: "left_hamstring",
        pattern: "Shortened left stride and reduced hip extension vs. baseline",
        description:
            "Steps off the left leg appear shorter and hip extension on that side appears reduced compared with Lucas's pre-injury sparring footage.",
        confidence: 0.77,
        metric: () => ({ label: "Left stride length", observed: 81, baseline: 100, unit: "% of baseline" }),
        timestampsMs: (analysis) =>
            analysis.movementEvents
                .filter((e) => e.type === "step_in" || e.type === "step_out")
                .slice(0, 4)
                .map((e) => e.startMs),
        status: "acknowledged",
        review: {
            reviewerId: "u-samuel-brooks",
            reviewedAt: daysAgo(3, 14, 10),
            note: "Consistent with the known left hamstring strain at phase 3 of rehab. Stride asymmetry is expected at this stage; re-checking at the next physio session.",
        },
        linkedInjuryId: "inj-lucas-hamstring",
    },
    {
        id: "al-marcus-hand-11d",
        key: "marcus-bag-11d",
        bodyRegion: "right_hand",
        pattern: "Abrupt deceleration and guard drop after right-cross impact",
        description:
            "After a right cross lands on the bag in the final round, the right hand appears to decelerate abruptly and is held low; no further right-hand strikes follow.",
        confidence: 0.72,
        metric: (analysis) => {
            const ctx = findingContext(analysis);
            const impact = ctx.events.find((e) => e.type === "guard_drop" && e.detail.includes("withdrawn"));
            const earlier = ctx.events.filter((e) => e.type === "guard_drop" && e !== impact);
            return {
                label: "Right-hand guard recovery after the cross",
                observed: impact ? impact.endMs - impact.startMs : 0,
                baseline: earlier.length > 0 ? Math.round(average(earlier.map((e) => e.endMs - e.startMs))) : 420,
                unit: "ms",
            };
        },
        timestampsMs: (analysis) => {
            const impact = analysis.movementEvents.find((e) => e.type === "guard_drop" && e.detail.includes("withdrawn"));
            if (!impact) return [];
            const cross = [...analysis.detections].reverse().find((d) => d.type === "cross" && d.endMs <= impact.startMs + 100);
            return cross ? [cross.peakMs, impact.startMs] : [impact.startMs];
        },
        status: "follow_up",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(10, 8, 40),
            note: "Matches the right-hand injury reported by the coach after the session. Examined and imaged — see the injury record.",
        },
        linkedInjuryId: "inj-marcus-hand",
    },
    {
        id: "al-diego-balance-6d",
        key: "diego-sparring-6d",
        bodyRegion: "head",
        pattern: "Unsteady stance and delayed guard recovery after an exchange",
        description:
            "Following an exchange in round 3, guard recovery appears slower than earlier in the clip and several lateral steps appear unsteady with a narrowing base. Partner occlusion lowers confidence in this observation.",
        confidence: 0.61,
        metric: (analysis) => {
            const ctx = findingContext(analysis);
            const earlier = ctx.events.filter((e) => e.type === "guard_drop" && e.endMs < ctx.durationMs * 0.84);
            return {
                label: "Guard recovery after the exchange",
                observed: guardRecoveryAfter(ctx, "exchange"),
                baseline: Math.round(average(earlier.map((e) => e.endMs - e.startMs))),
                unit: "ms",
            };
        },
        timestampsMs: (analysis) =>
            analysis.movementEvents
                .filter((e) => e.detail.startsWith("Delayed") || e.detail.startsWith("Unsteady"))
                .slice(0, 4)
                .map((e) => e.startMs),
        status: "follow_up",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(6, 21, 35),
            note: "Reviewed alongside the coach's report from the session. Concussion assessment completed; graded return-to-training protocol started — see the injury record.",
        },
        linkedInjuryId: "inj-diego-concussion",
    },
    {
        id: "al-linh-knee-5d",
        key: "linh-bag-5d",
        bodyRegion: "left_knee",
        pattern: "Knee valgus on roundhouse-kick landing",
        description: "On some left-leg roundhouse kicks the left knee appears to move inward as the foot lands back in stance.",
        confidence: 0.58,
        metric: () => ({ label: "Knee valgus angle on kick landing", observed: 11, baseline: 7, unit: "°" }),
        timestampsMs: (analysis) => ranked(strikesIn(findingContext(analysis), { type: "kick", limb: "left_leg" }), "peakSpeed", 3).map((d) => d.endMs),
        status: "dismissed",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(4, 11, 0),
            note: "Reviewed the kick landings frame by frame — knee alignment is within normal landing mechanics for this kick. No action needed.",
        },
        linkedInjuryId: null,
    },
    {
        id: "al-hoang-trunk-7d",
        key: "hoang-shadow-7d",
        bodyRegion: "lower_back",
        pattern: "Reduced trunk rotation on rear-hand strikes vs. baseline",
        description:
            "Rear-hand strikes appear to rotate the trunk less than in Hoàng's pad session 30 days ago. Poor lighting reduces keypoint precision, so this observation should be confirmed on better footage.",
        confidence: 0.66,
        metric: (analysis) => ({
            label: "Trunk rotation on rear-hand strikes",
            observed: meanOf(strikesIn(findingContext(analysis), { type: "cross" }), "hipRotationDeg"),
            baseline: meanOf(strikesIn(findingContext(analysisOf("hoang-pads-30d")), { type: "cross" }), "hipRotationDeg"),
            unit: "°",
        }),
        timestampsMs: (analysis) => ranked(strikesIn(findingContext(analysis), { type: "cross" }), "hipRotationDeg", 4, "lowest").map((d) => d.peakMs),
        status: "new",
        review: null,
        linkedInjuryId: null,
    },
];

function buildAlerts(): AbnormalMovementAlert[] {
    return ALERT_PLANS.map((plan) => {
        const analysis = analysisOf(plan.key);
        analysis.alertIds.push(plan.id);
        const decision: DoctorDecision | null = plan.status === "new" ? null : plan.status;
        return {
            id: plan.id,
            analysisId: analysis.id,
            videoId: analysis.videoId,
            fighterId: analysis.fighterId,
            detectedAt: analysis.processedAt,
            bodyRegion: plan.bodyRegion,
            pattern: plan.pattern,
            description: plan.description,
            confidence: plan.confidence,
            metric: plan.metric(analysis),
            timestampsMs: plan.timestampsMs(analysis),
            status: plan.status,
            doctorReview:
                plan.review && decision
                    ? {
                          decision,
                          reviewerId: plan.review.reviewerId,
                          reviewerName: userName(plan.review.reviewerId),
                          reviewedAt: clampPastToday(plan.review.reviewedAt),
                          note: plan.review.note,
                      }
                    : null,
            linkedInjuryId: plan.linkedInjuryId,
        };
    });
}

export const mockAbnormalMovementAlerts: AbnormalMovementAlert[] = buildAlerts();

/* ─── Model registry ──────────────────────────────────────────────────────── */

/** Blends historical review agreement with the reviews present in the seed. */
function agreement(historical: { count: number; pct: number }, seeded: { agreed: number; total: number }): { humanAgreementPct: number; reviewsCount: number } {
    const reviewsCount = historical.count + seeded.total;
    const agreed = (historical.count * historical.pct) / 100 + seeded.agreed;
    return { humanAgreementPct: round((agreed / reviewsCount) * 100, 1), reviewsCount };
}

const strikeReviews = mockAIAnalyses.flatMap((a) => [...a.detections.map((d) => d.review), ...a.findings.map((f) => f.review)]).filter((r) => r !== null);
const alertReviews = mockAbnormalMovementAlerts.map((a) => a.doctorReview).filter((r) => r !== null);

export const mockAIModels: AIModel[] = [
    {
        id: MODEL.fighterDetection,
        name: "fighter-det",
        task: "fighter_detection",
        version: "2.1.0",
        framework: "PyTorch 2.4 · TensorRT 10",
        status: "active",
        description:
            "Single-stage detector that locates fighters, pad holders and sparring partners and keeps a persistent track on the analysed fighter.",
        deployedAt: daysAgo(96, 14, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 11,
        precision: 0.97,
        recall: 0.95,
        humanAgreementPct: 97.2,
        reviewsCount: 412,
    },
    {
        id: MODEL.poseMedium,
        name: "yolov8m-pose",
        task: "pose_estimation",
        version: "1.4.0",
        framework: "Ultralytics 8.3 · TensorRT 10",
        status: "active",
        description:
            "YOLOv8-medium pose model (17 keypoints) fine-tuned on 38k annotated combat-sports frames. Replaced yolov8n-pose for better wrist and ankle accuracy under motion blur.",
        deployedAt: daysAgo(58, 10, 30),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 24,
        precision: 0.91,
        recall: 0.89,
        humanAgreementPct: 92.6,
        reviewsCount: 655,
    },
    {
        id: MODEL.poseNano,
        name: "yolov8n-pose",
        task: "pose_estimation",
        version: "1.2.0",
        framework: "Ultralytics 8.1 · ONNX Runtime",
        status: "deprecated",
        description: "Original lightweight pose model shipped with the first video worker. Kept for rollback only.",
        deployedAt: daysAgo(240, 9, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 9,
        precision: 0.84,
        recall: 0.8,
        humanAgreementPct: 86.1,
        reviewsCount: 1204,
    },
    {
        id: MODEL.strike,
        name: "strike-cls",
        task: "action_recognition",
        version: "2.3.1",
        framework: "PyTorch 2.4 (ST-GCN)",
        status: "active",
        description:
            "Spatio-temporal graph network over pose sequences that classifies jab, cross, hook and kick and groups strikes into combinations. Hook recall is the weakest class (0.74): hooks thrown at an angle to the camera are often read as crosses.",
        deployedAt: daysAgo(44, 11, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 38,
        precision: 0.9,
        recall: 0.86,
        ...agreement({ count: 1860, pct: 87.9 }, { agreed: strikeReviews.filter((r) => r.decision === "confirmed").length, total: strikeReviews.length }),
    },
    {
        id: MODEL.strikeRc,
        name: "strike-cls",
        task: "action_recognition",
        version: "2.4.0-rc1",
        framework: "PyTorch 2.4 (ST-GCN)",
        status: "staging",
        description:
            "Release candidate retrained with 2,100 coach corrections from 2.3.1. Offline evaluation raises hook recall to 0.81; shadow-deployed on 10% of jobs.",
        deployedAt: daysAgo(6, 15, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 41,
        precision: 0.92,
        recall: 0.89,
        humanAgreementPct: 90.3,
        reviewsCount: 184,
    },
    {
        id: MODEL.anomaly,
        name: "move-anomaly",
        task: "anomaly_detection",
        version: "0.9.2-beta",
        framework: "PyTorch 2.4 (LSTM autoencoder)",
        status: "active",
        description:
            "Compares joint kinematics with the fighter's own baseline footage to surface possible abnormal movement for doctor review. Beta: observations are supporting information only.",
        deployedAt: daysAgo(71, 16, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 120,
        precision: 0.71,
        recall: 0.78,
        ...agreement({ count: 96, pct: 72 }, { agreed: alertReviews.filter((r) => r.decision !== "dismissed").length, total: alertReviews.length }),
    },
    {
        id: MODEL.anomalyRc,
        name: "move-anomaly",
        task: "anomaly_detection",
        version: "1.0.0-rc1",
        framework: "PyTorch 2.4 (LSTM autoencoder)",
        status: "staging",
        description: "Adds per-fighter asymmetry baselines and fatigue normalisation; reduces false positives on kick landings in offline tests.",
        deployedAt: daysAgo(9, 13, 30),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 135,
        precision: 0.76,
        recall: 0.8,
        humanAgreementPct: 79.5,
        reviewsCount: 38,
    },
];
