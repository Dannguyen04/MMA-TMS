import type { AnalysisMetrics, BodyActivity, Detection, MovementEvent, MovementEventType, StrikeType, VideoTrainingType } from "@/lib/domain/types";
import { average, clamp, round, sum } from "@/lib/utils";

/**
 * Performance metrics derived from AI outputs (detections + movement events).
 * Shared by the mock analysis generator and the real worker-result mapper, so both
 * pipelines compute every number the same way. Pure and client-safe.
 */

/** Background footwork (bouncing, small adjustments) per minute of active footage, metres. */
export const AMBIENT_FOOTWORK_M_PER_MIN: Record<VideoTrainingType, number> = {
    shadow_boxing: 7.5,
    pad_work: 6,
    heavy_bag: 4.5,
    sparring: 8.5,
};

type DetectionField = "peakSpeed" | "jointAngleDeg" | "hipRotationDeg" | "confidence";

/** Mean of a numeric detection field, rounded. 0 for an empty list. */
export function meanOf(detections: Detection[], field: DetectionField, decimals = 1): number {
    return round(average(detections.map((d) => d[field])), decimals);
}

/** Converts raw movement-energy weights into whole-number shares that add up to 100. */
export function toBodyActivityShares(weights: BodyActivity): BodyActivity {
    const keys = Object.keys(weights) as (keyof BodyActivity)[];
    const total = sum(keys.map((k) => weights[k])) || 1;
    const parts = keys.map((k) => {
        const exact = (weights[k] / total) * 100;
        return { k, exact, value: Math.floor(exact) };
    });
    let remainder = 100 - sum(parts.map((p) => p.value));
    [...parts]
        .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
        .forEach((p) => {
            if (remainder > 0) {
                p.value += 1;
                remainder -= 1;
            }
        });
    const shares: BodyActivity = { hands: 0, legs: 0, head: 0, shoulders: 0, hips: 0 };
    parts.forEach((p) => (shares[p.k] = p.value));
    return shares;
}

export interface MetricsInput {
    durationMs: number;
    trainingType: VideoTrainingType;
    detections: Detection[];
    combinationCount: number;
    events: MovementEvent[];
    /** Knee chamber angle of each kick, degrees. */
    kickChamberDeg: number[];
    /** Distance to the target for each strike, in body-lengths (empty when there is no target). */
    targetDistances: number[];
    /** Time between combinations, ms. */
    restMs: number;
    /** Time between rounds (fighter off task), ms. */
    breakMs: number;
    /** Share of rest time spent with a loose guard, 0–1. */
    restGuardLapse: number;
    stanceWidthRatio: number;
    balanceScore: number;
}

export function computeAnalysisMetrics(input: MetricsInput): AnalysisMetrics {
    const { detections, events } = input;
    const minutes = input.durationMs / 60_000;
    const ofType = (type: StrikeType) => detections.filter((d) => d.type === type);
    const count = (type: MovementEventType) => events.filter((e) => e.type === type).length;
    const totalDuration = (type: MovementEventType) => sum(events.filter((e) => e.type === type).map((e) => e.endMs - e.startMs));

    const punches = detections.filter((d) => d.type !== "kick");
    const kicks = ofType("kick");
    const straights = detections.filter((d) => d.type === "jab" || d.type === "cross");

    const guardDrops = events.filter((e) => e.type === "guard_drop");
    const lostMs = totalDuration("tracking_lost");
    const activeMs = Math.max(1, input.durationMs - input.breakMs - lostMs);
    const downMs = totalDuration("guard_drop") + input.restGuardLapse * input.restMs;
    const uptimePct = round(clamp(100 * (1 - downMs / activeMs), 0, 100), 1);

    const slips = count("slip");
    const rolls = count("roll");
    const movesPerMin = round((slips + rolls) / minutes, 1);
    const pivots = count("pivot");
    const steps = count("step_in") + count("step_out");
    const lateral = count("lateral_step");
    const activeShare = activeMs / input.durationMs;
    const distanceM = round(steps * 0.42 + lateral * 0.38 + pivots * 0.2 + AMBIENT_FOOTWORK_M_PER_MIN[input.trainingType] * minutes * activeShare, 1);

    const bodyActivity = toBodyActivityShares({
        hands: sum(punches.map((d) => d.peakSpeed)),
        shoulders: punches.length * 2.6 + ofType("hook").length * 1.2,
        hips: sum(detections.map((d) => d.hipRotationDeg)) / 12,
        legs: sum(kicks.map((d) => d.peakSpeed)) * 1.4 + (steps + lateral + pivots) * 2.2 + distanceM * 0.6,
        head: (slips + rolls) * 6,
    });

    return {
        strikeCounts: { jab: ofType("jab").length, cross: ofType("cross").length, hook: ofType("hook").length, kick: kicks.length },
        combinations: input.combinationCount,
        strikesPerMin: round(detections.length / minutes, 1),
        avgPeakSpeed: {
            jab: meanOf(ofType("jab"), "peakSpeed"),
            cross: meanOf(ofType("cross"), "peakSpeed"),
            hook: meanOf(ofType("hook"), "peakSpeed"),
            kick: meanOf(kicks, "peakSpeed"),
        },
        avgPunchExtensionDeg: meanOf(straights, "jointAngleDeg"),
        avgKickChamberDeg: round(average(input.kickChamberDeg), 1),
        avgHipRotationDeg: meanOf(detections, "hipRotationDeg"),
        guard: {
            uptimePct,
            drops: guardDrops.length,
            avgRecoveryMs: Math.round(average(guardDrops.map((e) => e.endMs - e.startMs))),
        },
        headMovement: {
            movesPerMin,
            slips,
            rolls,
            centerlineExposurePct: round(clamp(58 - movesPerMin * 2.4 + (100 - uptimePct) * 0.5, 12, 75), 1),
        },
        footwork: {
            distanceM,
            pivots,
            stanceWidthRatio: input.stanceWidthRatio,
            balanceScore: input.balanceScore,
        },
        relativeDistance: input.targetDistances.length > 0 ? round(average(input.targetDistances), 2) : null,
        bodyActivity,
    };
}
