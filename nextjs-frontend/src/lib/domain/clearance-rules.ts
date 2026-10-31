import type { BodyRegion, Technique, TrainingRestriction, TrainingType } from "./types";

/** What a restriction asks of planned training, in the terms the scheduler checks. */
export interface RestrictionEffects {
    /** Training types that must not be planned. */
    blocksTypes: TrainingType[];
    /** Techniques to avoid; the coach must acknowledge a session that includes them. */
    avoidTechniques: Technique[];
    /** Body regions to protect; the coach must acknowledge a session that loads them. */
    protectRegions: BodyRegion[];
    maxRpe: number | null;
}

/**
 * How strongly a restriction constrains training:
 * - "block": it forbids at least one training type;
 * - "limit": it caps session intensity (RPE) without forbidding a type;
 * - "warn": it only names techniques or body regions, which need coach acknowledgement.
 */
export type RestrictionSeverity = "block" | "limit" | "warn";

export function restrictionEffects(restriction: TrainingRestriction): RestrictionEffects {
    return {
        blocksTypes: restriction.blockedTrainingTypes,
        avoidTechniques: restriction.blockedTechniques,
        protectRegions: restriction.blockedRegions,
        maxRpe: restriction.maxRpe,
    };
}

/**
 * Mirrors `checkTrainingAgainstClearance` in rules.ts: blocked training types and RPE caps block a
 * session, techniques and regions only warn. Escalating technique restrictions to blocking is a
 * product decision to make in rules.ts; this function and the restriction UI follow that rule.
 */
export function restrictionSeverity(restriction: TrainingRestriction): RestrictionSeverity {
    if (restriction.blockedTrainingTypes.length > 0) return "block";
    if (restriction.maxRpe !== null) return "limit";
    return "warn";
}
