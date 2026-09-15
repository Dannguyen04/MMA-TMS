import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type {
    AIAnalysis,
    AIFeedback,
    AIFinding,
    AnalysisMetrics,
    Combination,
    Detection,
    Fighter,
    FindingCategory,
    FindingImpact,
    FindingMetricRef,
    ISODate,
    Limb,
    ModelVersions,
    MovementEvent,
    MovementEventType,
    ReviewDecision,
    Stance,
    StrikeType,
    TrainingLevel,
    Video,
    VideoTrainingType,
} from "@/lib/domain/types";
import { average, clamp, round, sum } from "@/lib/utils";
import { computeAnalysisMetrics, meanOf } from "@/lib/video/metrics";
import { createRandom, type Random } from "./random";

export { meanOf };

/**
 * Deterministic generation of AI analyses from a per-video "script".
 *
 * A script describes what happened on camera (strike repertoire, rest rhythm, how often the
 * guard drops, lighting/occlusion quality…). The generator lays out combinations on a timeline,
 * derives detections and movement events from it, computes every metric FROM those outputs and
 * finally attaches findings whose evidence (timestamps, detection ids) really exists.
 */

/** Model versions stamped on analyses produced by the production pipeline. */
export const PRODUCTION_MODEL_VERSIONS: ModelVersions = {
    detection: "fighter-det 2.1.0",
    pose: "yolov8m-pose 1.4.0",
    action: "strike-cls 2.3.1",
    anomaly: "move-anomaly 0.9.2-beta",
};

/* ─── Strike vocabulary ───────────────────────────────────────────────────── */

/** Strike token used in combination scripts. Lead/rear resolve to limbs from the stance. */
type MoveToken = "jab" | "cross" | "lead_hook" | "rear_hook" | "lead_kick" | "rear_kick" | "teep" | "switch_kick";

type Side = "lead" | "rear";
type Orientation = "orthodox" | "southpaw";
type Range = [number, number];

interface MoveSpec {
    type: StrikeType;
    side: Side;
    label: string;
    durationMs: Range;
    /** Peak speed of a professional male at full effort, m/s. */
    baseSpeed: number;
    jointAngleDeg: Range;
    hipRotationDeg: Range;
    /** Knee chamber angle for kicks, degrees. */
    chamberDeg: Range | null;
}

const MOVES: Record<MoveToken, MoveSpec> = {
    jab: { type: "jab", side: "lead", label: "Jab", durationMs: [240, 320], baseSpeed: 7.3, jointAngleDeg: [152, 170], hipRotationDeg: [8, 20], chamberDeg: null },
    cross: { type: "cross", side: "rear", label: "Cross", durationMs: [290, 380], baseSpeed: 8.4, jointAngleDeg: [156, 175], hipRotationDeg: [38, 56], chamberDeg: null },
    lead_hook: { type: "hook", side: "lead", label: "Hook", durationMs: [320, 430], baseSpeed: 7.7, jointAngleDeg: [88, 112], hipRotationDeg: [34, 50], chamberDeg: null },
    rear_hook: { type: "hook", side: "rear", label: "Rear hook", durationMs: [340, 450], baseSpeed: 7.9, jointAngleDeg: [90, 114], hipRotationDeg: [40, 56], chamberDeg: null },
    lead_kick: { type: "kick", side: "lead", label: "Lead kick", durationMs: [500, 680], baseSpeed: 10.2, jointAngleDeg: [150, 170], hipRotationDeg: [45, 64], chamberDeg: [55, 80] },
    rear_kick: { type: "kick", side: "rear", label: "Rear kick", durationMs: [580, 780], baseSpeed: 11.8, jointAngleDeg: [152, 172], hipRotationDeg: [62, 86], chamberDeg: [48, 72] },
    teep: { type: "kick", side: "lead", label: "Teep", durationMs: [460, 620], baseSpeed: 9.6, jointAngleDeg: [160, 176], hipRotationDeg: [14, 28], chamberDeg: [38, 58] },
    switch_kick: { type: "kick", side: "lead", label: "Switch kick", durationMs: [620, 800], baseSpeed: 11.3, jointAngleDeg: [150, 170], hipRotationDeg: [60, 82], chamberDeg: [50, 74] },
};

export interface WeightedCombo {
    moves: MoveToken[];
    weight: number;
}

const combo = (weight: number, ...moves: MoveToken[]): WeightedCombo => ({ moves, weight });

type RepertoireKey = "boxing" | "muay_thai" | "kickboxing" | "karate" | "grappler";

export const REPERTOIRES: Record<RepertoireKey, WeightedCombo[]> = {
    boxing: [
        combo(3, "jab"),
        combo(2, "jab", "jab"),
        combo(5, "jab", "cross"),
        combo(4, "jab", "cross", "lead_hook"),
        combo(2, "lead_hook", "cross"),
        combo(2, "cross", "lead_hook", "cross"),
        combo(2, "jab", "jab", "cross"),
        combo(2, "jab", "cross", "lead_hook", "cross"),
        combo(1, "jab", "rear_hook"),
    ],
    muay_thai: [
        combo(2, "jab"),
        combo(4, "jab", "cross"),
        combo(4, "jab", "cross", "lead_hook"),
        combo(3, "lead_hook", "rear_kick"),
        combo(3, "jab", "cross", "rear_kick"),
        combo(2, "cross", "lead_hook", "cross"),
        combo(2, "teep"),
        combo(1, "jab", "teep"),
        combo(2, "rear_kick"),
        combo(2, "jab", "cross", "lead_hook", "rear_kick"),
    ],
    kickboxing: [
        combo(2, "jab"),
        combo(4, "jab", "cross"),
        combo(3, "jab", "cross", "lead_hook"),
        combo(4, "jab", "cross", "rear_kick"),
        combo(3, "lead_hook", "rear_kick"),
        combo(2, "switch_kick"),
        combo(2, "jab", "switch_kick"),
        combo(3, "rear_kick"),
        combo(2, "cross", "lead_hook", "rear_kick"),
        combo(1, "teep"),
    ],
    karate: [
        combo(3, "jab"),
        combo(4, "jab", "cross"),
        combo(3, "lead_kick"),
        combo(2, "rear_kick"),
        combo(2, "jab", "rear_kick"),
        combo(2, "teep"),
        combo(1, "jab", "cross", "lead_kick"),
        combo(1, "lead_hook"),
        combo(1, "switch_kick"),
    ],
    grappler: [
        combo(3, "jab"),
        combo(5, "jab", "cross"),
        combo(2, "jab", "cross", "lead_hook"),
        combo(1, "cross", "lead_hook"),
        combo(2, "jab", "jab", "cross"),
        combo(1, "rear_kick"),
        combo(1, "jab", "cross", "rear_kick"),
    ],
};

const LEAD_HAND_ONLY: WeightedCombo[] = [combo(3, "jab"), combo(1, "jab", "jab")];

/** Removes combinations that contain any of the given strikes (e.g. no kicks during rehab). */
export function withoutMoves(repertoire: WeightedCombo[], excluded: MoveToken[]): WeightedCombo[] {
    return repertoire.filter((c) => !c.moves.some((m) => excluded.includes(m)));
}

/** Adds extra weight to combinations that contain a strike (e.g. a hook-focused pad session). */
export function emphasise(repertoire: WeightedCombo[], move: MoveToken, factor: number): WeightedCombo[] {
    return repertoire.map((c) => (c.moves.includes(move) ? { ...c, weight: c.weight * factor } : c));
}

/* ─── Script tuning ───────────────────────────────────────────────────────── */

interface Incident {
    /** rear_hand_impact: rear hand withdrawn after a cross, only lead-hand strikes afterwards. unsteady_after_exchange: slow guard recovery and unsteady steps after an exchange. */
    kind: "rear_hand_impact" | "unsteady_after_exchange";
    atSec: number;
}

export interface ScriptTuning {
    repertoire: WeightedCombo[];
    /** Compressed footage: a short break is inserted every N seconds. */
    roundLengthSec: number;
    restSec: Range;
    handSpeedFactor: number;
    kickSpeedFactor: number;
    /** Added to the base detection confidence for the training type (lighting, camera quality). */
    confidenceShift: number;
    /** Share of hooks the classifier confuses with straight punches (confidence < 0.6). */
    hookConfusionRate: number;
    lowConfidenceRate: number;
    guardDropRates: Partial<Record<MoveToken, number>>;
    guardRecoveryMs: Range;
    /** Share of rest time spent with a loose guard. */
    restGuardLapse: number;
    headMovesPerMin: number;
    pivotRate: number;
    trackingLosses: number;
    trackingLossDetail: string | null;
    /** Baseline share of frames with a usable track before explicit tracking losses. */
    trackingQuality: number;
    hookElbowDeg: Range;
    /** Degrees added to jab/cross elbow extension (negative = punches fall short). */
    straightExtensionShift: number;
    /** Multiplier on hip rotation for rear-hand punches (reduced trunk rotation). */
    rearHipRotationFactor: number;
    stanceWidthRatio: number;
    balanceScore: number;
    /** Switch-stance fighters: share of combinations thrown from southpaw. */
    southpawShare: number;
    incident: Incident | null;
}

const TYPE_DEFAULTS: Record<VideoTrainingType, Omit<ScriptTuning, "repertoire">> = {
    shadow_boxing: {
        roundLengthSec: 60,
        restSec: [1.4, 3.0],
        handSpeedFactor: 1,
        kickSpeedFactor: 1,
        confidenceShift: 0,
        hookConfusionRate: 0.06,
        lowConfidenceRate: 0.02,
        guardDropRates: {},
        guardRecoveryMs: [300, 520],
        restGuardLapse: 0.1,
        headMovesPerMin: 9,
        pivotRate: 0.3,
        trackingLosses: 1,
        trackingLossDetail: null,
        trackingQuality: 0.96,
        hookElbowDeg: [88, 112],
        straightExtensionShift: 0,
        rearHipRotationFactor: 1,
        stanceWidthRatio: 1.26,
        balanceScore: 86,
        southpawShare: 0.3,
        incident: null,
    },
    pad_work: {
        roundLengthSec: 60,
        restSec: [1.6, 3.4],
        handSpeedFactor: 1,
        kickSpeedFactor: 1,
        confidenceShift: 0,
        hookConfusionRate: 0.06,
        lowConfidenceRate: 0.02,
        guardDropRates: {},
        guardRecoveryMs: [300, 520],
        restGuardLapse: 0.12,
        headMovesPerMin: 6,
        pivotRate: 0.3,
        trackingLosses: 2,
        trackingLossDetail: null,
        trackingQuality: 0.95,
        hookElbowDeg: [88, 112],
        straightExtensionShift: 0,
        rearHipRotationFactor: 1,
        stanceWidthRatio: 1.28,
        balanceScore: 86,
        southpawShare: 0.3,
        incident: null,
    },
    heavy_bag: {
        roundLengthSec: 60,
        restSec: [1.0, 2.6],
        handSpeedFactor: 1,
        kickSpeedFactor: 1,
        confidenceShift: 0,
        hookConfusionRate: 0.06,
        lowConfidenceRate: 0.02,
        guardDropRates: {},
        guardRecoveryMs: [300, 540],
        restGuardLapse: 0.14,
        headMovesPerMin: 3.5,
        pivotRate: 0.25,
        trackingLosses: 1,
        trackingLossDetail: null,
        trackingQuality: 0.94,
        hookElbowDeg: [88, 112],
        straightExtensionShift: 0,
        rearHipRotationFactor: 1,
        stanceWidthRatio: 1.3,
        balanceScore: 85,
        southpawShare: 0.3,
        incident: null,
    },
    sparring: {
        roundLengthSec: 90,
        restSec: [2.2, 5.0],
        handSpeedFactor: 1,
        kickSpeedFactor: 1,
        confidenceShift: 0,
        hookConfusionRate: 0.15,
        lowConfidenceRate: 0.1,
        guardDropRates: {},
        guardRecoveryMs: [320, 600],
        restGuardLapse: 0.18,
        headMovesPerMin: 10,
        pivotRate: 0.25,
        trackingLosses: 6,
        trackingLossDetail: null,
        trackingQuality: 0.82,
        hookElbowDeg: [88, 114],
        straightExtensionShift: 0,
        rearHipRotationFactor: 1,
        stanceWidthRatio: 1.3,
        balanceScore: 80,
        southpawShare: 0.3,
        incident: null,
    },
};

/** Training-type defaults with per-video overrides applied. */
export function resolveTuning(type: VideoTrainingType, repertoire: WeightedCombo[], overrides: Partial<ScriptTuning> = {}): ScriptTuning {
    return { ...TYPE_DEFAULTS[type], repertoire, ...overrides };
}

const BASE_CONFIDENCE: Record<VideoTrainingType, number> = { shadow_boxing: 0.87, pad_work: 0.88, heavy_bag: 0.86, sparring: 0.76 };
const STEP_IN_CHANCE: Record<VideoTrainingType, number> = { shadow_boxing: 0.45, pad_work: 0.5, heavy_bag: 0.35, sparring: 0.6 };
const STEP_OUT_CHANCE: Record<VideoTrainingType, number> = { shadow_boxing: 0.4, pad_work: 0.45, heavy_bag: 0.4, sparring: 0.6 };
/** Typical distance to the target in body-lengths; null when there is no target. */
const TARGET_DISTANCE: Record<VideoTrainingType, number | null> = { shadow_boxing: null, pad_work: 0.62, heavy_bag: 0.48, sparring: 0.9 };

const HEAD_MOVE_DETAILS: Record<VideoTrainingType, { slip: string[]; roll: string[] }> = {
    shadow_boxing: {
        slip: ["Slip to the outside after the combination", "Slip to the inside, head off the centreline"],
        roll: ["Roll under an imagined hook", "Roll back to stance after the exchange"],
    },
    pad_work: {
        slip: ["Slip off the pad holder's jab", "Slip outside the pad holder's straight return"],
        roll: ["Roll under the pad holder's hook", "Roll under the pad sweep"],
    },
    heavy_bag: {
        slip: ["Slip off the swinging bag", "Slip to the outside of the bag"],
        roll: ["Roll under the bag's return swing"],
    },
    sparring: {
        slip: ["Slip inside the partner's jab", "Slip outside the partner's cross"],
        roll: ["Roll under the partner's hook", "Roll out of the clinch exchange"],
    },
};

const TRACKING_LOSS_DETAIL: Record<VideoTrainingType, string> = {
    shadow_boxing: "Fighter partially out of frame",
    pad_work: "Fighter occluded by the pad holder",
    heavy_bag: "Fighter occluded by the bag",
    sparring: "Fighter occluded by the sparring partner",
};

/* ─── Findings templates ──────────────────────────────────────────────────── */

export interface FindingContext {
    durationMs: number;
    detections: Detection[];
    combinations: Combination[];
    events: MovementEvent[];
    metrics: AnalysisMetrics;
}

type DetectionField = "peakSpeed" | "jointAngleDeg" | "hipRotationDeg" | "confidence";

type EvidenceSelector =
    | {
          from: "detections";
          type?: StrikeType;
          limb?: Limb;
          guardMaintained?: boolean;
          lowConfidence?: boolean;
          /** Fractions of the clip, e.g. [0.67, 1] for the final third. */
          window?: Range;
          rankBy?: DetectionField;
          rank?: "highest" | "lowest";
          limit: number;
      }
    | { from: "combinations"; labelPrefix?: string; window?: Range; limit: number }
    | { from: "events"; types: MovementEventType[]; detail?: string; window?: Range; limit: number };

export interface ReviewSeed {
    decision: ReviewDecision;
    note: string | null;
    correctedLabel: string | null;
}

export interface FindingTemplate {
    category: FindingCategory;
    impact: FindingImpact;
    title: string;
    description: string | ((ctx: FindingContext) => string);
    confidence: number;
    evidence: EvidenceSelector;
    metric: ((ctx: FindingContext) => FindingMetricRef) | null;
    recommendation: string;
    /** Applied only when the analysis has a reviewer. */
    review: ReviewSeed | null;
    /** The finding is only produced when this holds (and evidence exists). */
    when?: (ctx: FindingContext) => boolean;
}

interface Reviewer {
    id: string;
    name: string;
    reviewedAt: ISODate;
}

/** Detections filtered by type, limb and clip window. */
export function strikesIn(ctx: FindingContext, filter: { type?: StrikeType; limb?: Limb; window?: Range }): Detection[] {
    return ctx.detections.filter(
        (d) =>
            (!filter.type || d.type === filter.type) &&
            (!filter.limb || d.limb === filter.limb) &&
            inWindow(d.peakMs, ctx.durationMs, filter.window),
    );
}

/** Share of detections thrown with the guard kept, 0–100. */
function guardKeptPct(detections: Detection[]): number {
    if (detections.length === 0) return 100;
    return Math.round((detections.filter((d) => d.guardMaintained).length / detections.length) * 100);
}

/** Mean duration of guard-drop events whose detail mentions a strike label. */
export function guardRecoveryAfter(ctx: FindingContext, strikeWord: string): number {
    const drops = ctx.events.filter((e) => e.type === "guard_drop" && e.detail.toLowerCase().includes(strikeWord));
    return Math.round(average(drops.map((e) => e.endMs - e.startMs)));
}

/** Punch-speed change from the first to the final third of the clip, percent. */
function punchSpeedChangePct(ctx: FindingContext): { first: number; last: number; changePct: number } {
    const punches = (window: Range) => ctx.detections.filter((d) => d.type !== "kick" && inWindow(d.peakMs, ctx.durationMs, window));
    const first = meanOf(punches([0, 0.34]), "peakSpeed");
    const last = meanOf(punches([0.67, 1]), "peakSpeed");
    return { first, last, changePct: first === 0 ? 0 : round(((last - first) / first) * 100, 1) };
}

function guardHandName(limb: Limb): string {
    if (limb === "left_arm") return "Right hand";
    if (limb === "right_arm") return "Left hand";
    return limb === "left_leg" ? "Left hand" : "Right hand";
}

interface TemplateOptions {
    confidence?: number;
    review?: ReviewSeed | null;
    reference?: string;
}

export function crossExtensionFinding(o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "cross",
        impact: "strength",
        title: "Cross extension appears consistently strong",
        description: (ctx) =>
            `Straight punches reached an average elbow extension of ${ctx.metrics.avgPunchExtensionDeg}°, and crosses averaged ${meanOf(strikesIn(ctx, { type: "cross" }), "hipRotationDeg")}° of hip rotation.`,
        confidence: o.confidence ?? 0.86,
        evidence: { from: "detections", type: "cross", rankBy: "jointAngleDeg", limit: 4 },
        metric: (ctx) => ({ label: "Average straight-punch extension", value: ctx.metrics.avgPunchExtensionDeg, unit: "°", reference: o.reference ?? "Target 155–175°" }),
        recommendation: "Keep turning the rear heel through the cross so the extension holds up in later rounds.",
        review: o.review ?? null,
        when: (ctx) => ctx.metrics.strikeCounts.cross >= 3,
    };
}

export function guardAfterLeadHookFinding(limb: Limb, o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "guard",
        impact: "concern",
        title: "Guard appears to drop after the lead hook",
        description: (ctx) => {
            const hooks = strikesIn(ctx, { type: "hook", limb });
            const dropped = hooks.filter((h) => !h.guardMaintained).length;
            return `The ${guardHandName(limb).toLowerCase()} appears to leave the chin on ${dropped} of ${hooks.length} lead hooks, taking about ${guardRecoveryAfter(ctx, "hook")} ms to return.`;
        },
        confidence: o.confidence ?? 0.82,
        evidence: { from: "detections", type: "hook", limb, guardMaintained: false, limit: 5 },
        metric: (ctx) => ({ label: "Guard kept after lead hooks", value: guardKeptPct(strikesIn(ctx, { type: "hook", limb })), unit: "%", reference: o.reference ?? "Team avg 76%" }),
        recommendation:
            "Drill jab–cross–hook on pads with the holder tapping the open side after every hook; the rear glove stays on the cheekbone until the hook returns.",
        review: o.review ?? null,
        when: (ctx) => {
            const hooks = strikesIn(ctx, { type: "hook", limb });
            return hooks.filter((h) => !h.guardMaintained).length >= 2 && guardKeptPct(hooks) < 80;
        },
    };
}

export function kickGuardFinding(limb: Limb, o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "guard",
        impact: "improvement",
        title: "Arm may swing low during rear kicks",
        description: (ctx) => {
            const kicks = strikesIn(ctx, { type: "kick", limb });
            return `The ${guardHandName(limb).toLowerCase()} appears to drop below the chin on ${kicks.filter((k) => !k.guardMaintained).length} of ${kicks.length} kicks from that side.`;
        },
        confidence: o.confidence ?? 0.74,
        evidence: { from: "detections", type: "kick", limb, guardMaintained: false, limit: 4 },
        metric: (ctx) => ({ label: "Guard kept during rear kicks", value: guardKeptPct(strikesIn(ctx, { type: "kick", limb })), unit: "%", reference: o.reference ?? "Team avg 70%" }),
        recommendation: "Kick with the same-side glove brushing the cheek for one round, then return to a natural arm swing at 50% range.",
        review: o.review ?? null,
        when: (ctx) => {
            const kicks = strikesIn(ctx, { type: "kick", limb });
            return kicks.filter((k) => !k.guardMaintained).length >= 2 && guardKeptPct(kicks) < 75;
        },
    };
}

export function guardUptimeFinding(impact: "strength" | "concern", o: TemplateOptions = {}): FindingTemplate {
    const strong = impact === "strength";
    return {
        category: "guard",
        impact,
        title: strong ? "Guard appears well maintained between exchanges" : "Guard appears to drop between strikes",
        description: (ctx) =>
            `Estimated guard uptime was ${ctx.metrics.guard.uptimePct}% with ${ctx.metrics.guard.drops} possible guard drops (average recovery ${ctx.metrics.guard.avgRecoveryMs} ms).`,
        confidence: o.confidence ?? (strong ? 0.84 : 0.72),
        evidence: strong ? { from: "combinations", limit: 4 } : { from: "events", types: ["guard_drop"], limit: 5 },
        metric: (ctx) => ({ label: "Guard uptime", value: ctx.metrics.guard.uptimePct, unit: "%", reference: o.reference ?? "Team avg 81%" }),
        recommendation: strong
            ? "Keep the same hand position when fatigue sets in; film one late round next week to confirm it holds."
            : "Finish every combination with both gloves touching the cheekbones for a beat before moving — use a mirror round to check.",
        review: o.review ?? null,
        when: (ctx) => (strong ? ctx.metrics.guard.uptimePct >= 84 : ctx.metrics.guard.uptimePct < 80 && ctx.metrics.guard.drops >= 2),
    };
}

export function headMovementFinding(impact: "strength" | "improvement", o: TemplateOptions = {}): FindingTemplate {
    const strong = impact === "strength";
    return {
        category: "head_movement",
        impact,
        title: strong ? "Head movement appears frequent and well timed" : "Head movement between combinations appears limited",
        description: (ctx) =>
            `${ctx.metrics.headMovement.slips} slips and ${ctx.metrics.headMovement.rolls} rolls were detected (${ctx.metrics.headMovement.movesPerMin} per minute); estimated centreline exposure was ${ctx.metrics.headMovement.centerlineExposurePct}%.`,
        confidence: o.confidence ?? (strong ? 0.87 : 0.74),
        evidence: { from: "events", types: ["slip", "roll"], limit: 4 },
        metric: (ctx) => ({ label: "Head movements per minute", value: ctx.metrics.headMovement.movesPerMin, unit: "/min", reference: o.reference ?? "Team avg 9.1/min" }),
        recommendation: strong
            ? "Keep pairing slips with a return strike so the movement creates counters, not just evasion."
            : "Add a slip or roll after every second combination in the next pad session.",
        review: o.review ?? null,
    };
}

export function lowConfidenceHooksFinding(o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "hook",
        impact: "improvement",
        title: "Some hooks may have been misread — review suggested",
        description: (ctx) => {
            const hooks = strikesIn(ctx, { type: "hook" });
            const low = hooks.filter((h) => h.confidence < LOW_CONFIDENCE_THRESHOLD).length;
            return `${low} of ${hooks.length} hook detections fell below the 60% confidence threshold. Looping crosses and hooks thrown at an angle to the camera are the most common source of confusion.`;
        },
        confidence: o.confidence ?? 0.52,
        evidence: { from: "detections", type: "hook", lowConfidence: true, limit: 5 },
        metric: (ctx) => ({
            label: "Hook detections below 60% confidence",
            value: strikesIn(ctx, { type: "hook" }).filter((h) => h.confidence < LOW_CONFIDENCE_THRESHOLD).length,
            unit: "detections",
            reference: null,
        }),
        recommendation: "Confirm or correct these detections; corrections update the metrics and help retrain the strike model.",
        review: o.review ?? null,
        when: (ctx) => strikesIn(ctx, { type: "hook" }).filter((h) => h.confidence < LOW_CONFIDENCE_THRESHOLD).length >= 2,
    };
}

export function kickRotationFinding(limb: Limb, o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "kick",
        impact: "strength",
        title: "Rear kick appears to turn the hip over fully",
        description: (ctx) => {
            const kicks = strikesIn(ctx, { type: "kick", limb });
            return `Kicks from this side averaged ${meanOf(kicks, "hipRotationDeg")}° of hip rotation and ${meanOf(kicks, "peakSpeed")} m/s peak foot speed.`;
        },
        confidence: o.confidence ?? 0.83,
        evidence: { from: "detections", type: "kick", limb, rankBy: "hipRotationDeg", limit: 3 },
        metric: (ctx) => ({ label: "Average rear-kick speed", value: meanOf(strikesIn(ctx, { type: "kick", limb }), "peakSpeed"), unit: "m/s", reference: o.reference ?? null }),
        recommendation: "Keep the rotation and return the kicking leg to stance faster so the guard resets sooner.",
        review: o.review ?? null,
        when: (ctx) => strikesIn(ctx, { type: "kick", limb }).length >= 3,
    };
}

export function speedFadeFinding(o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "combination",
        impact: "improvement",
        title: "Hand speed appears to fade in the final third",
        description: (ctx) => {
            const { first, last } = punchSpeedChangePct(ctx);
            return `Average punch speed moved from ${first} m/s in the first third of the clip to ${last} m/s in the final third.`;
        },
        confidence: o.confidence ?? 0.69,
        evidence: { from: "detections", type: "cross", window: [0.67, 1], rankBy: "peakSpeed", rank: "lowest", limit: 4 },
        metric: (ctx) => ({ label: "Punch speed, final vs first third", value: punchSpeedChangePct(ctx).changePct, unit: "%", reference: "First third of the clip" }),
        recommendation: "Finish pad sessions with two rounds of 20 s fast hands / 10 s rest to build speed endurance.",
        review: o.review ?? null,
        when: (ctx) => punchSpeedChangePct(ctx).changePct <= -3,
    };
}

export function pivotFinding(impact: "strength" | "improvement", o: TemplateOptions = {}): FindingTemplate {
    const strong = impact === "strength";
    return {
        category: "footwork",
        impact,
        title: strong ? "Pivots used to create angles after combinations" : "Pivots after hooks appear infrequent",
        description: (ctx) =>
            `${ctx.metrics.footwork.pivots} pivots were detected against ${ctx.metrics.strikeCounts.hook} hooks; estimated footwork distance was ${ctx.metrics.footwork.distanceM} m.`,
        confidence: o.confidence ?? (strong ? 0.8 : 0.68),
        evidence: strong ? { from: "events", types: ["pivot"], limit: 4 } : { from: "detections", type: "hook", limit: 4 },
        metric: (ctx) => ({ label: "Pivots", value: ctx.metrics.footwork.pivots, unit: "pivots", reference: o.reference ?? `${ctx.metrics.strikeCounts.hook} hooks thrown` }),
        recommendation: strong
            ? "Keep finishing on an angle; add a rear-hand counter off the pivot to make it a threat."
            : "After each lead hook, pivot off the lead foot before resetting — 3 rounds of hook–pivot on pads.",
        review: o.review ?? null,
        when: (ctx) =>
            strong ? ctx.metrics.footwork.pivots >= 3 : ctx.metrics.strikeCounts.hook >= 4 && ctx.metrics.footwork.pivots < ctx.metrics.strikeCounts.hook / 3,
    };
}

export function jabRangeFinding(o: TemplateOptions = {}): FindingTemplate {
    return {
        category: "jab",
        impact: "strength",
        title: "Jab used consistently to find range",
        description: (ctx) =>
            `${ctx.metrics.strikeCounts.jab} jabs were detected (${Math.round((ctx.metrics.strikeCounts.jab / Math.max(1, ctx.detections.length)) * 100)}% of strikes), most opening a combination.`,
        confidence: o.confidence ?? 0.85,
        evidence: { from: "combinations", labelPrefix: "Jab", limit: 4 },
        metric: (ctx) => ({
            label: "Jab share of strikes",
            value: Math.round((ctx.metrics.strikeCounts.jab / Math.max(1, ctx.detections.length)) * 100),
            unit: "%",
            reference: o.reference ?? null,
        }),
        recommendation: "Double the jab occasionally to change rhythm before committing to the rear hand.",
        review: o.review ?? null,
        when: (ctx) => ctx.metrics.strikeCounts.jab >= 5,
    };
}

/** Findings produced for footage uploaded at runtime (no hand-written script). */
function defaultFindingTemplates(stance: Stance): FindingTemplate[] {
    const leadArm: Limb = stance === "southpaw" ? "right_arm" : "left_arm";
    const rearLeg: Limb = stance === "southpaw" ? "left_leg" : "right_leg";
    return [
        crossExtensionFinding(),
        guardAfterLeadHookFinding(leadArm),
        guardUptimeFinding("concern"),
        guardUptimeFinding("strength"),
        kickRotationFinding(rearLeg),
        headMovementFinding("improvement"),
        lowConfidenceHooksFinding(),
        speedFadeFinding(),
    ];
}

/* ─── Script & generation ─────────────────────────────────────────────────── */

interface AnalysisScript {
    analysisId: string;
    videoId: string;
    jobId: string;
    fighterId: string;
    trainingType: VideoTrainingType;
    stance: Stance;
    durationSec: number;
    fps: number;
    processedAt: ISODate;
    models: ModelVersions;
    seed: string;
    tuning: ScriptTuning;
    /** Second sentence of the summary. */
    summaryNote: string;
    findings: FindingTemplate[];
    reviewer: Reviewer | null;
    coachReview: { rating: number; summary: string } | null;
}

interface DraftDetection {
    detection: Detection;
    side: Side;
    chamberDeg: number | null;
    distance: number | null;
}

type DraftEvent = Omit<MovementEvent, "id">;

interface Timeline {
    drafts: DraftDetection[];
    combinations: Combination[];
    events: MovementEvent[];
    restMs: number;
    breakMs: number;
    unsteadyEvents: number;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function analysisKey(analysisId: string): string {
    return analysisId.replace(/^an-/, "");
}

function inWindow(ms: number, durationMs: number, window: Range | undefined): boolean {
    if (!window) return true;
    return ms >= window[0] * durationMs && ms <= window[1] * durationMs;
}

function pickWeighted(items: WeightedCombo[], rng: Random): WeightedCombo {
    const total = sum(items.map((i) => i.weight));
    let target = rng.next() * total;
    for (const item of items) {
        target -= item.weight;
        if (target <= 0) return item;
    }
    return items[items.length - 1];
}

function limbFor(spec: MoveSpec, orientation: Orientation): Limb {
    const leftIsLead = orientation === "orthodox";
    const isLeft = spec.side === "lead" ? leftIsLead : !leftIsLead;
    if (spec.type === "kick") return isLeft ? "left_leg" : "right_leg";
    return isLeft ? "left_arm" : "right_arm";
}

function spreadTimes(count: number, durationMs: number, rng: Random): number[] {
    return Array.from({ length: count }, (_, i) => ((i + 0.5 + rng.jitter(0.35)) / count) * durationMs).sort((a, b) => a - b);
}

function detectionConfidence(spec: MoveSpec, script: AnalysisScript, impaired: boolean, rng: Random): number {
    const { tuning } = script;
    if (spec.type === "hook" && rng.chance(tuning.hookConfusionRate)) return rng.float(0.42, 0.59);
    if (rng.chance(tuning.lowConfidenceRate)) return rng.float(0.44, 0.59);
    let confidence = BASE_CONFIDENCE[script.trainingType] + tuning.confidenceShift + rng.jitter(0.07);
    if (spec.type === "hook") confidence -= 0.04;
    if (spec.type === "kick") confidence += 0.02;
    if (impaired) confidence -= 0.05;
    return round(clamp(confidence, 0.4, 0.97), 2);
}

function buildTimeline(script: AnalysisScript, rng: Random): Timeline {
    const { tuning, trainingType } = script;
    const key = analysisKey(script.analysisId);
    const durationMs = script.durationSec * 1000;
    const endLimit = durationMs - 1800;
    const drafts: DraftDetection[] = [];
    const combinations: Combination[] = [];
    const events: DraftEvent[] = [];
    const lossTimes = spreadTimes(tuning.trackingLosses, durationMs, rng);
    const incidentAtMs = tuning.incident ? tuning.incident.atSec * 1000 : Number.POSITIVE_INFINITY;
    const eventConfidence = () =>
        round(clamp(rng.float(0.72, 0.94) + (trainingType === "sparring" ? -0.08 : 0) + tuning.confidenceShift * 0.5, 0.45, 0.97), 2);

    let restMs = 0;
    let breakMs = 0;
    let unsteadyEvents = 0;
    let lossIndex = 0;
    let impaired = false;
    let t = rng.int(1200, 2800);
    let nextBreak = tuning.roundLengthSec * 1000;

    while (t < endLimit) {
        if (t >= nextBreak) {
            const gap = rng.int(3500, 6000);
            breakMs += gap;
            t += gap;
            nextBreak += tuning.roundLengthSec * 1000;
            continue;
        }

        const incident = tuning.incident;
        const triggersIncident = incident !== null && !impaired && t >= incidentAtMs;
        const repertoire = impaired && incident?.kind === "rear_hand_impact" ? LEAD_HAND_ONLY : tuning.repertoire;
        const moves: MoveToken[] = triggersIncident
            ? incident.kind === "rear_hand_impact"
                ? ["jab", "cross"]
                : ["jab", "cross", "lead_hook"]
            : pickWeighted(repertoire, rng).moves;
        const orientation: Orientation =
            script.stance === "switch" ? (rng.chance(tuning.southpawShare) ? "southpaw" : "orthodox") : script.stance;

        if (rng.chance(STEP_IN_CHANCE[trainingType])) {
            const d = rng.int(200, 320);
            events.push({ type: "step_in", startMs: t, endMs: t + d, confidence: eventConfidence(), detail: "Step in to range" });
            t += d - 40;
        }

        const comboDrafts: DraftDetection[] = [];
        let cursor = t;
        moves.forEach((token, index) => {
            const spec = MOVES[token];
            const limb = limbFor(spec, orientation);
            const isKick = spec.type === "kick";
            const duration = rng.int(spec.durationMs[0], spec.durationMs[1]);
            const startMs = cursor;
            const peakMs = startMs + Math.round(duration * rng.float(0.5, 0.62));
            const endMs = startMs + duration;
            const fatigue = 1 - 0.06 * (startMs / durationMs);
            const speedFactor = (isKick ? tuning.kickSpeedFactor : tuning.handSpeedFactor) * fatigue * (impaired ? 0.89 : 1);
            const peakSpeed = round(clamp(spec.baseSpeed * speedFactor * (1 + rng.jitter(0.05)), isKick ? 9 : 6, isKick ? 14 : 10), 1);
            const speedFloor = isKick ? 9 : 6;
            const speedSpan = isKick ? 5 : 4;
            const rearOffset = spec.side === "rear" ? 2 : 0;
            const straightShift = spec.type === "jab" || spec.type === "cross" ? tuning.straightExtensionShift : 0;
            const angleRange: Range =
                spec.type === "hook"
                    ? [tuning.hookElbowDeg[0] + rearOffset, tuning.hookElbowDeg[1] + rearOffset]
                    : [spec.jointAngleDeg[0] + straightShift, Math.min(178, spec.jointAngleDeg[1] + straightShift)];
            const hipFactor = spec.side === "rear" && !isKick ? tuning.rearHipRotationFactor : 1;
            const isIncidentStrike = triggersIncident && index === moves.length - 1;
            const unsteadyPenalty = impaired && incident?.kind === "unsteady_after_exchange" ? 0.3 : 0;
            const handHeldLow = impaired && incident?.kind === "rear_hand_impact" ? 0.45 : 0;
            const dropRate = (tuning.guardDropRates[token] ?? 0.04) + unsteadyPenalty + handHeldLow;
            const guardMaintained = isIncidentStrike ? false : !rng.chance(dropRate);
            const baseDistance = TARGET_DISTANCE[trainingType];

            const detection: Detection = {
                id: `det-${key}-${pad(drafts.length + 1, 3)}`,
                type: spec.type,
                limb,
                startMs,
                peakMs,
                endMs,
                confidence: detectionConfidence(spec, script, impaired, rng),
                peakSpeed,
                accelerationProxy: round(clamp(((peakSpeed - speedFloor) / speedSpan) * 6 + 3 + rng.jitter(0.6), 0, 10), 1),
                jointAngleDeg: Math.round(rng.float(angleRange[0], angleRange[1], 0)),
                hipRotationDeg: Math.round(rng.float(spec.hipRotationDeg[0], spec.hipRotationDeg[1], 0) * hipFactor),
                guardMaintained,
                combinationId: null,
                review: null,
            };
            const draft: DraftDetection = {
                detection,
                side: spec.side,
                chamberDeg: spec.chamberDeg ? Math.round(rng.float(spec.chamberDeg[0], spec.chamberDeg[1], 0)) : null,
                distance:
                    baseDistance === null ? null : round(baseDistance * (token === "teep" ? 1.35 : isKick ? 1.25 : 1) * (1 + rng.jitter(0.12)), 2),
            };
            drafts.push(draft);
            comboDrafts.push(draft);

            if (!guardMaintained) {
                const hand = guardHandName(limb);
                let recovery = rng.int(tuning.guardRecoveryMs[0], tuning.guardRecoveryMs[1]);
                let detail = isKick
                    ? `${hand} swung low during the ${spec.label.toLowerCase()}`
                    : `${hand} dropped below the chin after the ${spec.label.toLowerCase()}`;
                if (isIncidentStrike && incident?.kind === "rear_hand_impact") {
                    recovery = rng.int(1300, 1650);
                    detail = `${limb === "right_arm" ? "Right" : "Left"} hand withdrawn and held low after the cross`;
                } else if (isIncidentStrike) {
                    recovery = rng.int(1150, 1500);
                    detail = "Delayed guard recovery after the exchange";
                    unsteadyEvents += 1;
                } else if (unsteadyPenalty > 0) {
                    recovery = Math.round(recovery * 2.2);
                    detail = "Slow guard recovery between exchanges";
                    unsteadyEvents += 1;
                }
                events.push({ type: "guard_drop", startMs: endMs - 40, endMs: endMs - 40 + recovery, confidence: eventConfidence(), detail });
            }

            const nextToken = moves[index + 1];
            const kickTransition = isKick || (nextToken !== undefined && MOVES[nextToken].type === "kick");
            cursor = endMs + (kickTransition ? rng.int(90, 180) : rng.int(150, 250));
        });

        if (comboDrafts.length >= 2) {
            const id = `cmb-${key}-${pad(combinations.length + 1, 2)}`;
            comboDrafts.forEach((d) => (d.detection.combinationId = id));
            combinations.push({
                id,
                label: moves.map((m) => MOVES[m].label).join(" – "),
                detectionIds: comboDrafts.map((d) => d.detection.id),
                startMs: comboDrafts[0].detection.startMs,
                endMs: comboDrafts[comboDrafts.length - 1].detection.endMs,
                confidence: round(average(comboDrafts.map((d) => d.detection.confidence)) * 0.97, 2),
            });
        }
        const comboStart = comboDrafts[0].detection.startMs;
        if (triggersIncident) impaired = true;

        // Rest: footwork, head movement and tracking gaps between combinations.
        t = cursor;
        let r = t;
        const pushRestEvent = (type: MovementEventType, minMs: number, maxMs: number, detail: string, confidence = eventConfidence()) => {
            const d = rng.int(minMs, maxMs);
            events.push({ type, startMs: r, endMs: r + d, confidence, detail });
            r += d + rng.int(60, 200);
        };
        const lastMove = moves[moves.length - 1];
        if (MOVES[lastMove].type === "hook" && rng.chance(tuning.pivotRate)) {
            pushRestEvent("pivot", 350, 520, "Pivot off the lead foot after the hook");
        } else if (rng.chance(tuning.pivotRate * 0.25)) {
            pushRestEvent("pivot", 350, 520, "Pivot to reset the angle");
        }
        if (triggersIncident) {
            pushRestEvent("step_out", 260, 380, incident.kind === "rear_hand_impact" ? "Step back from the bag" : "Step back out of the exchange");
            if (incident.kind === "unsteady_after_exchange") {
                pushRestEvent("lateral_step", 320, 520, "Unsteady lateral step — base narrows");
                unsteadyEvents += 1;
            }
        } else if (rng.chance(STEP_OUT_CHANCE[trainingType])) {
            pushRestEvent("step_out", 220, 340, "Step back out of range");
        }
        if (impaired && incident?.kind === "unsteady_after_exchange" && rng.chance(0.45)) {
            pushRestEvent("lateral_step", 320, 520, "Unsteady lateral step — base narrows");
            unsteadyEvents += 1;
        } else if (rng.chance(0.18)) {
            pushRestEvent("lateral_step", 260, 380, "Lateral step to the lead side");
        }

        const restSlowdown = impaired ? (incident?.kind === "rear_hand_impact" ? 1.6 : 1.3) : 1;
        const plannedRest = Math.round(rng.float(tuning.restSec[0], tuning.restSec[1]) * 1000 * restSlowdown);
        const expectedHeadMoves = (tuning.headMovesPerMin * (cursor - comboStart + plannedRest)) / 60_000;
        const headMoves = Math.floor(expectedHeadMoves) + (rng.chance(expectedHeadMoves % 1) ? 1 : 0);
        const details = HEAD_MOVE_DETAILS[trainingType];
        for (let i = 0; i < headMoves; i++) {
            if (rng.chance(0.65)) pushRestEvent("slip", 260, 400, rng.pick(details.slip));
            else pushRestEvent("roll", 420, 640, rng.pick(details.roll));
        }
        while (lossIndex < lossTimes.length && lossTimes[lossIndex] <= t + plannedRest) {
            pushRestEvent("tracking_lost", 500, 2200, tuning.trackingLossDetail ?? TRACKING_LOSS_DETAIL[trainingType], rng.float(0.9, 0.99));
            lossIndex += 1;
        }

        const restEnd = Math.max(t + plannedRest, r + 250);
        restMs += restEnd - t;
        t = restEnd;
    }

    const movementEvents = events
        .filter((e) => e.endMs <= durationMs)
        .sort((a, b) => a.startMs - b.startMs)
        .map<MovementEvent>((e, i) => ({ id: `mv-${key}-${pad(i + 1, 3)}`, ...e }));

    return { drafts, combinations, events: movementEvents, restMs, breakMs, unsteadyEvents };
}

function computeMetrics(timeline: Timeline, script: AnalysisScript, rng: Random): AnalysisMetrics {
    const { tuning } = script;
    // Random draws happen in this order to keep seeded analyses stable.
    const stanceWidthRatio = round(tuning.stanceWidthRatio + rng.jitter(0.03), 2);
    const balanceScore = Math.round(clamp(tuning.balanceScore - 2 * timeline.unsteadyEvents + rng.jitter(2), 35, 98));
    return computeAnalysisMetrics({
        durationMs: script.durationSec * 1000,
        trainingType: script.trainingType,
        detections: timeline.drafts.map((d) => d.detection),
        combinationCount: timeline.combinations.length,
        events: timeline.events,
        kickChamberDeg: timeline.drafts.map((d) => d.chamberDeg).filter((v): v is number => v !== null),
        targetDistances: timeline.drafts.map((d) => d.distance).filter((v): v is number => v !== null),
        restMs: timeline.restMs,
        breakMs: timeline.breakMs,
        restGuardLapse: tuning.restGuardLapse,
        stanceWidthRatio,
        balanceScore,
    });
}

function spreadPick<T>(items: T[], limit: number): T[] {
    if (items.length <= limit) return items;
    const step = items.length / limit;
    return Array.from({ length: limit }, (_, i) => items[Math.floor(i * step + step / 2)]);
}

function selectEvidence(selector: EvidenceSelector, ctx: FindingContext): { timestampsMs: number[]; detectionIds: string[] } {
    if (selector.from === "detections") {
        const matches = ctx.detections.filter(
            (d) =>
                (!selector.type || d.type === selector.type) &&
                (!selector.limb || d.limb === selector.limb) &&
                (selector.guardMaintained === undefined || d.guardMaintained === selector.guardMaintained) &&
                (selector.lowConfidence === undefined || d.confidence < LOW_CONFIDENCE_THRESHOLD === selector.lowConfidence) &&
                inWindow(d.peakMs, ctx.durationMs, selector.window),
        );
        const rankBy = selector.rankBy;
        const chosen = rankBy
            ? [...matches]
                  .sort((a, b) => (selector.rank === "lowest" ? a[rankBy] - b[rankBy] : b[rankBy] - a[rankBy]))
                  .slice(0, selector.limit)
                  .sort((a, b) => a.peakMs - b.peakMs)
            : spreadPick(matches, selector.limit);
        return { timestampsMs: chosen.map((d) => d.peakMs), detectionIds: chosen.map((d) => d.id) };
    }
    if (selector.from === "combinations") {
        const matches = ctx.combinations.filter(
            (c) => (!selector.labelPrefix || c.label.startsWith(selector.labelPrefix)) && inWindow(c.startMs, ctx.durationMs, selector.window),
        );
        const chosen = spreadPick(matches, selector.limit);
        return { timestampsMs: chosen.map((c) => c.startMs), detectionIds: chosen.flatMap((c) => c.detectionIds) };
    }
    const matches = ctx.events.filter(
        (e) =>
            selector.types.includes(e.type) &&
            (!selector.detail || e.detail.includes(selector.detail)) &&
            inWindow(e.startMs, ctx.durationMs, selector.window),
    );
    const chosen = spreadPick(matches, selector.limit);
    const detectionIds = chosen.flatMap((e) => {
        const preceding = ctx.detections.filter((d) => d.endMs >= e.startMs - 800 && d.endMs <= e.startMs + 100);
        return preceding.length > 0 ? [preceding[preceding.length - 1].id] : [];
    });
    return { timestampsMs: chosen.map((e) => e.startMs), detectionIds: [...new Set(detectionIds)] };
}

function feedbackFrom(seed: ReviewSeed, reviewer: Reviewer): AIFeedback {
    return {
        decision: seed.decision,
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        reviewedAt: reviewer.reviewedAt,
        note: seed.note,
        correctedLabel: seed.correctedLabel,
    };
}

function buildFindings(script: AnalysisScript, ctx: FindingContext): AIFinding[] {
    const key = analysisKey(script.analysisId);
    const findings: AIFinding[] = [];
    for (const template of script.findings) {
        if (template.when && !template.when(ctx)) continue;
        const evidence = selectEvidence(template.evidence, ctx);
        if (evidence.timestampsMs.length === 0) continue;
        findings.push({
            id: `fd-${key}-${findings.length + 1}`,
            category: template.category,
            impact: template.impact,
            title: template.title,
            description: typeof template.description === "function" ? template.description(ctx) : template.description,
            confidence: template.confidence,
            timestampsMs: evidence.timestampsMs,
            detectionIds: evidence.detectionIds,
            metric: template.metric ? template.metric(ctx) : null,
            recommendation: template.recommendation,
            review: script.reviewer && template.review ? feedbackFrom(template.review, script.reviewer) : null,
        });
    }
    return findings;
}

/** Coach review of individual detections: every low-confidence one plus a sample of confident ones. */
function reviewDetections(drafts: DraftDetection[], reviewer: Reviewer, rng: Random): void {
    let hookReviews = 0;
    let rejected = false;
    for (const { detection, side } of drafts) {
        if (detection.confidence >= LOW_CONFIDENCE_THRESHOLD) continue;
        if (detection.type === "hook") {
            hookReviews += 1;
            detection.review =
                hookReviews % 2 === 1
                    ? feedbackFrom(
                          side === "lead"
                              ? { decision: "corrected", note: "Lead hand stayed straight — the elbow flare read as a hook.", correctedLabel: "Jab" }
                              : { decision: "corrected", note: "Straight rear hand; the shoulder roll read as a hook.", correctedLabel: "Cross" },
                          reviewer,
                      )
                    : feedbackFrom({ decision: "confirmed", note: "Hook confirmed on frame-by-frame replay.", correctedLabel: null }, reviewer);
        } else if (!rejected) {
            rejected = true;
            detection.review = feedbackFrom({ decision: "rejected", note: "Feint only — no strike was thrown.", correctedLabel: null }, reviewer);
        } else {
            detection.review = feedbackFrom({ decision: "confirmed", note: null, correctedLabel: null }, reviewer);
        }
    }
    const confident = drafts.filter((d) => d.detection.review === null && d.detection.confidence >= 0.8);
    for (let i = 0; i < 6 && confident.length > 0; i++) {
        const [picked] = confident.splice(rng.int(0, confident.length - 1), 1);
        picked.detection.review = feedbackFrom({ decision: "confirmed", note: null, correctedLabel: null }, reviewer);
    }
}

/** Generates a complete, internally consistent analysis from a script. Deterministic for a given seed. */
export function generateAnalysis(script: AnalysisScript): AIAnalysis {
    const rng = createRandom(script.seed);
    const timeline = buildTimeline(script, rng);
    const metrics = computeMetrics(timeline, script, rng);
    if (script.reviewer) reviewDetections(timeline.drafts, script.reviewer, rng);

    const detections = timeline.drafts.map((d) => d.detection);
    const durationMs = script.durationSec * 1000;
    const ctx: FindingContext = { durationMs, detections, combinations: timeline.combinations, events: timeline.events, metrics };
    const lostMs = sum(timeline.events.filter((e) => e.type === "tracking_lost").map((e) => e.endMs - e.startMs));

    return {
        id: script.analysisId,
        videoId: script.videoId,
        jobId: script.jobId,
        fighterId: script.fighterId,
        processedAt: script.processedAt,
        durationMs,
        fps: script.fps,
        models: script.models,
        overallConfidence: round(average(detections.map((d) => d.confidence)), 2),
        trackingQuality: round(Math.min(script.tuning.trackingQuality, 1 - lostMs / durationMs), 2),
        summary: `The model detected ${detections.length} strikes (${metrics.strikesPerMin} per minute), including ${metrics.combinations} combinations, with an estimated guard uptime of ${metrics.guard.uptimePct}%. ${script.summaryNote}`,
        detections,
        combinations: timeline.combinations,
        movementEvents: timeline.events,
        metrics,
        findings: buildFindings(script, ctx),
        alertIds: [],
        coachReview:
            script.reviewer && script.coachReview
                ? {
                      reviewerId: script.reviewer.id,
                      reviewerName: script.reviewer.name,
                      reviewedAt: script.reviewer.reviewedAt,
                      rating: script.coachReview.rating,
                      summary: script.coachReview.summary,
                  }
                : null,
    };
}

/** Rebuilds the finding context of a stored analysis (for alert metrics and runtime checks). */
export function findingContext(analysis: AIAnalysis): FindingContext {
    return {
        durationMs: analysis.durationMs,
        detections: analysis.detections,
        combinations: analysis.combinations,
        events: analysis.movementEvents,
        metrics: analysis.metrics,
    };
}

/* ─── Runtime uploads ─────────────────────────────────────────────────────── */

const LEVEL_SPEED: Record<TrainingLevel, number> = { amateur: 0.9, semi_pro: 0.95, professional: 1, elite: 1.05 };

function repertoireForDiscipline(discipline: string): WeightedCombo[] {
    const d = discipline.toLowerCase();
    if (d.includes("muay")) return REPERTOIRES.muay_thai;
    if (d.includes("kick")) return REPERTOIRES.kickboxing;
    if (d.includes("boxing")) return REPERTOIRES.boxing;
    if (d.includes("karate") || d.includes("vovinam") || d.includes("taekwondo")) return REPERTOIRES.karate;
    return REPERTOIRES.grappler;
}

interface UploadScriptInput {
    analysisId: string;
    jobId: string;
    video: Video;
    fighter: Pick<Fighter, "id" | "stance" | "primaryDiscipline" | "level" | "sex">;
    processedAt: ISODate;
    models: ModelVersions;
}

/** Script for footage uploaded at runtime, seeded by the video id so re-generation is stable. */
export function buildUploadScript(input: UploadScriptInput): AnalysisScript {
    const { video, fighter } = input;
    const speed = LEVEL_SPEED[fighter.level] * (fighter.sex === "female" ? 0.9 : 1);
    const lossesPer3Min = TYPE_DEFAULTS[video.trainingType].trackingLosses;
    return {
        analysisId: input.analysisId,
        videoId: video.id,
        jobId: input.jobId,
        fighterId: fighter.id,
        trainingType: video.trainingType,
        stance: fighter.stance,
        durationSec: video.durationSec,
        fps: video.fps,
        processedAt: input.processedAt,
        models: input.models,
        seed: video.id,
        tuning: resolveTuning(video.trainingType, repertoireForDiscipline(fighter.primaryDiscipline), {
            handSpeedFactor: speed,
            kickSpeedFactor: speed,
            trackingLosses: Math.max(0, Math.round((lossesPer3Min * video.durationSec) / 180)),
        }),
        summaryNote:
            video.trainingType === "sparring"
                ? "Two fighters were in frame, so some detections carry lower confidence and should be reviewed."
                : "Detections with confidence below 60% are marked for coach review.",
        findings: defaultFindingTemplates(fighter.stance),
        reviewer: null,
        coachReview: null,
    };
}
