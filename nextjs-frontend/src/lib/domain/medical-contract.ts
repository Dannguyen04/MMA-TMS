/**
 * The medical service's own vocabulary, as the NestJS API returns it. Concepts the frontend domain doesn't have
 * (eligibility, review requests, allow-list restrictions, flat recovery milestones) live here instead of being
 * squeezed into the demo-era types. Safe for Server and Client Components.
 */

export const BODY_JOINTS = [
    "LEFT_SHOULDER",
    "RIGHT_SHOULDER",
    "LEFT_ELBOW",
    "RIGHT_ELBOW",
    "LEFT_WRIST",
    "RIGHT_WRIST",
    "LEFT_HIP",
    "RIGHT_HIP",
    "LEFT_KNEE",
    "RIGHT_KNEE",
    "LEFT_ANKLE",
    "RIGHT_ANKLE",
    "SPINE_CORE",
] as const;
export type BodyJoint = (typeof BODY_JOINTS)[number];

export const TECHNIQUE_TYPES = [
    "JAB",
    "CROSS",
    "LEAD_HOOK",
    "REAR_HOOK",
    "LEAD_UPPERCUT",
    "REAR_UPPERCUT",
    "LEAD_LOW_KICK",
    "REAR_LOW_KICK",
    "LEAD_MIDDLE_KICK",
    "REAR_MIDDLE_KICK",
    "LEAD_HIGH_KICK",
    "REAR_HIGH_KICK",
    "FRONT_TEEP",
    "SPINNING_BACK_FIST",
] as const;
export type TechniqueType = (typeof TECHNIQUE_TYPES)[number];

export const SESSION_TYPES = [
    "SHADOW_BOXING",
    "PAD_WORK",
    "HEAVY_BAG",
    "SPARRING",
    "GRAPPLING",
    "STRENGTH_CONDITIONING",
    "RECOVERY",
    "PHYSICAL_THERAPY",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type ExaminationScope = "TRAINING" | "COMPETITION";
export type ExaminationDecision = "ELIGIBLE" | "ELIGIBLE_WITH_RESTRICTIONS" | "NOT_ELIGIBLE";
export type ClearanceType = "TRAINING" | "COMPETITION" | "RETURN_FROM_INJURY";

export const ELIGIBILITY_REASONS = [
    "REVIEW_REQUEST_PENDING",
    "EXAMINATION_NOT_ELIGIBLE",
    "CLEARANCE_REQUIRED",
    "CLEARANCE_EXPIRED",
    "SESSION_TYPE_RESTRICTED",
] as const;
export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[number];

/** A doctor's written limits: what the fighter may do (allow-lists) and which joints to keep out of training. */
export interface ClinicalRestrictions {
    /** Null means every session type is allowed. */
    allowedSessionTypes: SessionType[] | null;
    /** Null means every technique is allowed. */
    allowedTechniqueTypes: TechniqueType[] | null;
    excludedJoints: BodyJoint[] | null;
    notes: string | null;
}

/** Whether a fighter may train (or compete) right now, and if not, why. */
export interface MedicalEligibility {
    scope: ExaminationScope;
    eligible: boolean;
    reasons: EligibilityReason[];
}

export interface RecoveryMilestone {
    id: string;
    title: string;
    criteria: string;
    /** Academy date, YYYY-MM-DD. */
    targetDate: string | null;
    isCompleted: boolean;
    completedAt: string | null;
    notes: string | null;
}

export interface MedicalReviewRequest {
    id: string;
    fighterId: string;
    requestedById: string;
    requesterRole: "FIGHTER" | "COACH" | "DOCTOR" | "ADMIN";
    reason: string;
    status: "OPEN" | "RESOLVED";
    requestedAt: string;
    resolvedByExaminationId: string | null;
    resolvedAt: string | null;
}

/* ─── Labels ──────────────────────────────────────────────────────────────── */

export const ELIGIBILITY_REASON_LABELS: Record<EligibilityReason, string> = {
    REVIEW_REQUEST_PENDING: "Medical review pending",
    EXAMINATION_NOT_ELIGIBLE: "Not eligible after examination",
    CLEARANCE_REQUIRED: "Clearance required",
    CLEARANCE_EXPIRED: "Clearance expired",
    SESSION_TYPE_RESTRICTED: "Session type restricted",
};

/** What each reason means for the fighter and what happens next, in plain words. */
export const ELIGIBILITY_REASON_DESCRIPTIONS: Record<EligibilityReason, string> = {
    REVIEW_REQUEST_PENDING: "A medical review has been requested. Training waits until a sports doctor records an examination.",
    EXAMINATION_NOT_ELIGIBLE: "The latest examination found the fighter not eligible to train. A new examination is needed first.",
    CLEARANCE_REQUIRED: "There is no valid Medical Clearance on file. A sports doctor needs to issue one.",
    CLEARANCE_EXPIRED: "The Medical Clearance has expired. A sports doctor needs to renew it.",
    SESSION_TYPE_RESTRICTED: "This type of session isn't allowed under the current medical restrictions.",
};

export const BODY_JOINT_LABELS: Record<BodyJoint, string> = {
    LEFT_SHOULDER: "Left shoulder",
    RIGHT_SHOULDER: "Right shoulder",
    LEFT_ELBOW: "Left elbow",
    RIGHT_ELBOW: "Right elbow",
    LEFT_WRIST: "Left wrist",
    RIGHT_WRIST: "Right wrist",
    LEFT_HIP: "Left hip",
    RIGHT_HIP: "Right hip",
    LEFT_KNEE: "Left knee",
    RIGHT_KNEE: "Right knee",
    LEFT_ANKLE: "Left ankle",
    RIGHT_ANKLE: "Right ankle",
    SPINE_CORE: "Spine and core",
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
    SHADOW_BOXING: "Shadow boxing",
    PAD_WORK: "Pad work",
    HEAVY_BAG: "Heavy bag",
    SPARRING: "Sparring",
    GRAPPLING: "Grappling",
    STRENGTH_CONDITIONING: "Strength & conditioning",
    RECOVERY: "Recovery",
    PHYSICAL_THERAPY: "Physical therapy",
};

export const TECHNIQUE_TYPE_LABELS: Record<TechniqueType, string> = {
    JAB: "Jab",
    CROSS: "Cross",
    LEAD_HOOK: "Lead hook",
    REAR_HOOK: "Rear hook",
    LEAD_UPPERCUT: "Lead uppercut",
    REAR_UPPERCUT: "Rear uppercut",
    LEAD_LOW_KICK: "Lead low kick",
    REAR_LOW_KICK: "Rear low kick",
    LEAD_MIDDLE_KICK: "Lead middle kick",
    REAR_MIDDLE_KICK: "Rear middle kick",
    LEAD_HIGH_KICK: "Lead high kick",
    REAR_HIGH_KICK: "Rear high kick",
    FRONT_TEEP: "Front teep",
    SPINNING_BACK_FIST: "Spinning back fist",
};

export const CLEARANCE_TYPE_LABELS: Record<ClearanceType, string> = {
    TRAINING: "Training",
    COMPETITION: "Competition",
    RETURN_FROM_INJURY: "Return from injury",
};

export const EXAMINATION_SCOPE_LABELS: Record<ExaminationScope, string> = {
    TRAINING: "Training",
    COMPETITION: "Competition",
};
