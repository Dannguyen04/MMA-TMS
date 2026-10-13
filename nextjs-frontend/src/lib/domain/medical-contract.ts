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

export const EXAMINATION_SCOPES = ["TRAINING", "COMPETITION"] as const;
export type ExaminationScope = (typeof EXAMINATION_SCOPES)[number];

export const EXAMINATION_DECISIONS = ["ELIGIBLE", "ELIGIBLE_WITH_RESTRICTIONS", "NOT_ELIGIBLE"] as const;
export type ExaminationDecision = (typeof EXAMINATION_DECISIONS)[number];

export const CLEARANCE_TYPES = ["TRAINING", "COMPETITION", "RETURN_FROM_INJURY"] as const;
export type ClearanceType = (typeof CLEARANCE_TYPES)[number];

/** Clearance types an examination of each scope can back. */
export const CLEARANCE_TYPES_BY_SCOPE: Record<ExaminationScope, readonly ClearanceType[]> = {
    TRAINING: ["TRAINING", "RETURN_FROM_INJURY"],
    COMPETITION: ["COMPETITION"],
};

export const API_INJURY_SEVERITIES = ["MINOR", "MODERATE", "SEVERE", "CRITICAL"] as const;
export type ApiInjurySeverity = (typeof API_INJURY_SEVERITIES)[number];

/** Resolved is final in the service: a recurrence is recorded as a new injury. */
export type ApiInjuryStatus = "ACTIVE" | "RECOVERING" | "RESOLVED";

/** Text limits the service validates, so forms can stop the same input before sending it. */
export const MEDICAL_TEXT_LIMITS = {
    reviewReason: 2_000,
    examinationReason: 4_000,
    restrictionNotes: 2_000,
    clearanceNotes: 2_000,
    revokeReason: 2_000,
    injuryType: 200,
    clinicalText: 4_000,
    treatmentType: 200,
    planTitle: 200,
} as const;

/** Most milestones one recovery plan request may carry. */
export const RECOVERY_MILESTONES_MAX = 50;

/** The reasons the medical service sends today. */
export const ELIGIBILITY_REASONS = [
    "EXAMINATION_REQUIRED",
    "REVIEW_REQUEST_PENDING",
    "EXAMINATION_NOT_ELIGIBLE",
    "CLEARANCE_REQUIRED",
    "CLEARANCE_EXPIRED",
    "SESSION_TYPE_RESTRICTED",
] as const;
/** A reason the service sent that this interface doesn't know yet. It is kept and shown, never dropped. */
export const OTHER_ELIGIBILITY_REASON = "OTHER_MEDICAL_REASON";
export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[number] | typeof OTHER_ELIGIBILITY_REASON;

const KNOWN_REASONS: ReadonlySet<string> = new Set(ELIGIBILITY_REASONS);

/** The service's reason codes in the interface's terms: unknown codes become one "other medical reason", in order, without repeats. */
export function eligibilityReasonsFrom(codes: readonly string[]): EligibilityReason[] {
    const reasons = codes.map((code): EligibilityReason => (KNOWN_REASONS.has(code) ? (code as EligibilityReason) : OTHER_ELIGIBILITY_REASON));
    return [...new Set(reasons)];
}

/* ─── Examination details ─────────────────────────────────────────────────── */

/** A BASELINE examination (with SCAT6, vitals and at least one assessed area) is needed before a fighter's first session. */
export const API_EXAMINATION_TYPES = ["BASELINE", "ROUTINE", "PRE_FIGHT", "POST_INJURY", "CONCUSSION_SCREEN", "RETURN_TO_PLAY"] as const;
export type ApiExaminationType = (typeof API_EXAMINATION_TYPES)[number];

export const API_ASSESSMENT_RESULTS = ["NORMAL", "ABNORMAL", "INCONCLUSIVE"] as const;
export type ApiAssessmentResult = (typeof API_ASSESSMENT_RESULTS)[number];

export const API_HYDRATION_LEVELS = ["GOOD", "FAIR", "POOR"] as const;
export type ApiHydration = (typeof API_HYDRATION_LEVELS)[number];

/** Limits the service validates on examination details. */
export const EXAMINATION_DETAIL_LIMITS = { assessments: 30, area: 150, note: 1_000 } as const;

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
    EXAMINATION_REQUIRED: "Baseline examination required",
    REVIEW_REQUEST_PENDING: "Medical review pending",
    EXAMINATION_NOT_ELIGIBLE: "Not eligible after examination",
    CLEARANCE_REQUIRED: "Clearance required",
    CLEARANCE_EXPIRED: "Clearance expired",
    SESSION_TYPE_RESTRICTED: "Session type restricted",
    OTHER_MEDICAL_REASON: "Other medical reason",
};

/** What each reason means for the fighter and what happens next, in plain words. */
export const ELIGIBILITY_REASON_DESCRIPTIONS: Record<EligibilityReason, string> = {
    EXAMINATION_REQUIRED: "Every fighter needs a baseline examination by their sports doctor, with a SCAT6, before training.",
    REVIEW_REQUEST_PENDING: "A medical review has been requested. Training waits until a sports doctor records an examination.",
    EXAMINATION_NOT_ELIGIBLE: "The latest examination found the fighter not eligible to train. A new examination is needed first.",
    CLEARANCE_REQUIRED: "There is no valid Medical Clearance on file. A sports doctor needs to issue one.",
    CLEARANCE_EXPIRED: "The Medical Clearance has expired. A sports doctor needs to renew it.",
    SESSION_TYPE_RESTRICTED: "This type of session isn't allowed under the current medical restrictions.",
    OTHER_MEDICAL_REASON: "The medical service gave another reason that this app can't show yet. Ask the sports doctor before training.",
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

export const EXAMINATION_SCOPE_DESCRIPTIONS: Record<ExaminationScope, string> = {
    TRAINING: "Whether the fighter may train. It can close open medical review requests.",
    COMPETITION: "Whether the fighter may compete in a bout.",
};

export const EXAMINATION_DECISION_LABELS: Record<ExaminationDecision, string> = {
    ELIGIBLE: "Eligible",
    ELIGIBLE_WITH_RESTRICTIONS: "Eligible with restrictions",
    NOT_ELIGIBLE: "Not eligible",
};

export const EXAMINATION_DECISION_DESCRIPTIONS: Record<ExaminationDecision, string> = {
    ELIGIBLE: "No limits. Issue a clearance next so the fighter can train.",
    ELIGIBLE_WITH_RESTRICTIONS: "Allowed within the limits you set. Issue a clearance next.",
    NOT_ELIGIBLE: "Training stops. Active clearances of this scope are revoked straight away.",
};

export const REQUESTER_ROLE_LABELS: Record<MedicalReviewRequest["requesterRole"], string> = {
    FIGHTER: "Fighter",
    COACH: "Coach",
    DOCTOR: "Doctor",
    ADMIN: "Admin",
};
