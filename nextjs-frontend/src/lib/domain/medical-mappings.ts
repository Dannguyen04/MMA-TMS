import type {
    BodyJoint,
    ClinicalRestrictions,
    ExaminationDecision,
    MedicalEligibility,
    RecoveryMilestone,
    SessionType,
    TechniqueType,
} from "./medical-contract";
import { TECHNIQUE_TYPES } from "./medical-contract";
import type { ClearanceState } from "./rules";
import type { BodyRegion, ExaminationOutcome, Technique, TrainingRestriction, TrainingType } from "./types";

/**
 * Pure translations between the medical service's vocabulary and the frontend domain. Safe for Server and
 * Client Components.
 */

/* ─── Body ────────────────────────────────────────────────────────────────── */

/** The body-map region each service joint lights up. Wrists map to the hand regions, the spine to the lower back. */
export const JOINT_REGIONS: Record<BodyJoint, BodyRegion> = {
    LEFT_SHOULDER: "left_shoulder",
    RIGHT_SHOULDER: "right_shoulder",
    LEFT_ELBOW: "left_elbow",
    RIGHT_ELBOW: "right_elbow",
    LEFT_WRIST: "left_hand",
    RIGHT_WRIST: "right_hand",
    LEFT_HIP: "left_hip",
    RIGHT_HIP: "right_hip",
    LEFT_KNEE: "left_knee",
    RIGHT_KNEE: "right_knee",
    LEFT_ANKLE: "left_ankle",
    RIGHT_ANKLE: "right_ankle",
    SPINE_CORE: "lower_back",
};

/** The service joint for a body-map region, or null for regions the service doesn't record (head, ribs, shins…). */
export function jointForRegion(region: BodyRegion): BodyJoint | null {
    const match = (Object.entries(JOINT_REGIONS) as [BodyJoint, BodyRegion][]).find(([, mapped]) => mapped === region);
    return match ? match[0] : null;
}

/* ─── Training ────────────────────────────────────────────────────────────── */

/** The frontend training type each service session type belongs to. */
const SESSION_TRAINING_TYPES: Record<SessionType, TrainingType> = {
    SHADOW_BOXING: "shadow_boxing",
    PAD_WORK: "pad_work",
    HEAVY_BAG: "heavy_bag",
    SPARRING: "sparring",
    GRAPPLING: "grappling",
    STRENGTH_CONDITIONING: "strength_conditioning",
    RECOVERY: "recovery_mobility",
    PHYSICAL_THERAPY: "recovery_mobility",
};

/** Service session types that count as a frontend training type. Technical drilling has none. */
export function sessionTypesFor(type: TrainingType): SessionType[] {
    return (Object.entries(SESSION_TRAINING_TYPES) as [SessionType, TrainingType][]).filter(([, mapped]) => mapped === type).map(([code]) => code);
}

const TRAINING_TYPES: TrainingType[] = [
    "shadow_boxing",
    "pad_work",
    "heavy_bag",
    "sparring",
    "technical_drilling",
    "grappling",
    "strength_conditioning",
    "recovery_mobility",
];

/** The frontend strike family of each service technique; null for strikes the frontend doesn't track. */
const TECHNIQUE_FAMILIES: Record<TechniqueType, Technique | null> = {
    JAB: "jab",
    CROSS: "cross",
    LEAD_HOOK: "hook",
    REAR_HOOK: "hook",
    LEAD_UPPERCUT: null,
    REAR_UPPERCUT: null,
    LEAD_LOW_KICK: "kick",
    REAR_LOW_KICK: "kick",
    LEAD_MIDDLE_KICK: "kick",
    REAR_MIDDLE_KICK: "kick",
    LEAD_HIGH_KICK: "kick",
    REAR_HIGH_KICK: "kick",
    FRONT_TEEP: "kick",
    SPINNING_BACK_FIST: null,
};

/** Frontend techniques the service also records, so an allow-list can block them. */
const STRIKE_FAMILIES: Technique[] = ["jab", "cross", "hook", "kick"];

/* ─── Restrictions ────────────────────────────────────────────────────────── */

/** Whether the lists limit training at all; notes alone don't. Mirrors the service's own rule. */
export function isRestricted(restrictions: Pick<ClinicalRestrictions, "allowedSessionTypes" | "allowedTechniqueTypes" | "excludedJoints"> | null): boolean {
    if (!restrictions) return false;
    return restrictions.allowedSessionTypes !== null || restrictions.allowedTechniqueTypes !== null || restrictions.excludedJoints !== null;
}

/**
 * The allow-lists as one frontend restriction (blocked types, techniques and regions), so the existing restriction
 * views and session checks keep working. A training type is blocked when none of its session types is allowed;
 * technical drilling has no session type, so any session allow-list blocks it. A strike family is blocked when none
 * of its techniques is allowed; the service doesn't track combinations, footwork, guard or head movement.
 */
export function restrictionFromAllowLists(restrictions: ClinicalRestrictions, id: string): TrainingRestriction {
    const allowedSessions = restrictions.allowedSessionTypes;
    const allowedTechniques = restrictions.allowedTechniqueTypes;
    return {
        id,
        label: restrictions.notes?.trim() || "Medical restrictions",
        blockedTrainingTypes: allowedSessions === null ? [] : TRAINING_TYPES.filter((type) => !sessionTypesFor(type).some((code) => allowedSessions.includes(code))),
        blockedTechniques:
            allowedTechniques === null
                ? []
                : STRIKE_FAMILIES.filter((family) => !TECHNIQUE_TYPES.some((code) => TECHNIQUE_FAMILIES[code] === family && allowedTechniques.includes(code))),
        blockedRegions: (restrictions.excludedJoints ?? []).map((joint) => JOINT_REGIONS[joint]),
        maxRpe: null,
    };
}

/* ─── Examinations & clearance ────────────────────────────────────────────── */

export const OUTCOME_FROM_DECISION: Record<ExaminationDecision, ExaminationOutcome> = {
    ELIGIBLE: "fit",
    ELIGIBLE_WITH_RESTRICTIONS: "fit_with_restrictions",
    NOT_ELIGIBLE: "unfit",
};

/**
 * The fighter's training clearance state from the service's eligibility verdict. The frontend never picks a
 * governing clearance itself: the verdict decides, and restrictions only colour an eligible fighter.
 *
 * - Nothing on file yet reads as "none": the service lets a fighter with no training examination and no open review
 *   train, but there is no clearance to show.
 * - A pending review, a not-eligible examination or a missing clearance means "not_cleared".
 * - An expired clearance means "expired".
 * - An eligible fighter is "restricted" when the examination or a valid clearance limits training, else "full".
 */
export function clearanceStateFromEligibility(
    eligibility: MedicalEligibility,
    currentExamination: { decision: ExaminationDecision } | null,
    restricted: boolean,
): ClearanceState {
    const reasons = new Set(eligibility.reasons);
    if (eligibility.eligible) {
        if (!currentExamination) return "none";
        return restricted || currentExamination.decision === "ELIGIBLE_WITH_RESTRICTIONS" ? "restricted" : "full";
    }
    if (!currentExamination && [...reasons].every((reason) => reason === "CLEARANCE_REQUIRED")) return "none";
    if (reasons.has("REVIEW_REQUEST_PENDING") || reasons.has("EXAMINATION_NOT_ELIGIBLE") || reasons.has("CLEARANCE_REQUIRED")) return "not_cleared";
    if (reasons.has("CLEARANCE_EXPIRED")) return "expired";
    return "not_cleared";
}

/* ─── History & milestones ────────────────────────────────────────────────── */

/** The newest revision of each record in a history listing, newest record first. */
export function latestRevisions<T extends { recordId: string; revision: number; recordedAt: string }>(entries: T[]): T[] {
    const latest = new Map<string, T>();
    for (const entry of entries) {
        const current = latest.get(entry.recordId);
        if (!current || entry.revision > current.revision) latest.set(entry.recordId, entry);
    }
    return [...latest.values()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

function isStandardMilestone(value: unknown): value is RecoveryMilestone {
    if (typeof value !== "object" || value === null) return false;
    const m = value as Record<string, unknown>;
    return typeof m.id === "string" && typeof m.title === "string" && typeof m.criteria === "string" && typeof m.isCompleted === "boolean";
}

/** Milestones in the standard shape, or null for a legacy array the service returns unchanged (shown as-is, never rewritten). */
export function standardMilestones(milestones: readonly unknown[]): RecoveryMilestone[] | null {
    return milestones.every(isStandardMilestone) ? (milestones as RecoveryMilestone[]) : null;
}

/** Share of milestones completed, 0–100; 0 when there are none. */
export function milestoneProgressPct(milestones: readonly RecoveryMilestone[]): number {
    if (milestones.length === 0) return 0;
    return Math.round((milestones.filter((milestone) => milestone.isCompleted).length / milestones.length) * 100);
}
