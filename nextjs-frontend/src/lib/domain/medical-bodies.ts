import type {
    ApiAssessmentResult,
    ApiExaminationType,
    ApiHydration,
    ApiInjurySeverity,
    ApiInjuryStatus,
    BodyJoint,
    ClearanceType,
    ExaminationDecision,
    ExaminationScope,
    RecoveryMilestone,
    SessionType,
    TechniqueType,
} from "./medical-contract";
import type { Scat6Input } from "./scat6";
import type { ExaminationAssessment, ExaminationType, Vitals } from "./types";

/**
 * Request bodies for the medical service's writes, built from input a form has already validated. Pure, so each
 * rule the service enforces on the body's shape (what may be sent together, what must be left out) is tested here
 * rather than discovered as a 422. Safe for Server and Client Components.
 */

/** A doctor's allow-lists. Null means no limit; the service reads a missing list the same way. */
export interface RestrictionLists {
    allowedSessionTypes: readonly SessionType[] | null;
    allowedTechniqueTypes: readonly TechniqueType[] | null;
    excludedJoints: readonly BodyJoint[] | null;
}

export type RestrictionListName = keyof RestrictionLists;

interface RestrictionListsBody {
    allowedSessionTypes?: SessionType[];
    allowedTechniqueTypes?: TechniqueType[];
    excludedJoints?: BodyJoint[];
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** The lists that limit something. An empty list can't be sent (the service needs at least one value), so it is left out. */
function listsBody(lists: RestrictionLists): RestrictionListsBody {
    const body: RestrictionListsBody = {};
    if (lists.allowedSessionTypes?.length) body.allowedSessionTypes = unique(lists.allowedSessionTypes);
    if (lists.allowedTechniqueTypes?.length) body.allowedTechniqueTypes = unique(lists.allowedTechniqueTypes);
    if (lists.excludedJoints?.length) body.excludedJoints = unique(lists.excludedJoints);
    return body;
}

const trimmed = (value: string | null | undefined): string | undefined => {
    const text = value?.trim();
    return text ? text : undefined;
};

/** The service spells the same codes in capitals (`baseline` → `BASELINE`). */
const upper = <T extends string>(value: T) => value.toUpperCase() as Uppercase<T>;

/* ─── Review requests ─────────────────────────────────────────────────────── */

export function reviewRequestBody(reason: string): { reason: string } {
    return { reason: reason.trim() };
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

/**
 * What the doctor recorded at the visit. A baseline carries vitals, at least one assessed area and its SCAT6; any
 * other type may leave them out.
 */
export interface ExaminationDetailsInput {
    type: ExaminationType;
    vitals: Vitals | null;
    assessments: readonly ExaminationAssessment[];
    recommendations: string | null;
    /** Academy date, YYYY-MM-DD. */
    followUpDate: string | null;
    scat6: Scat6Input | null;
}

export interface ExaminationDecisionInput {
    scope: ExaminationScope;
    decision: ExaminationDecision;
    /** ISO timestamp, not in the future. */
    examinedAt: string;
    reason: string;
    restrictions: (RestrictionLists & { notes: string | null }) | null;
    validUntil: string | null;
    /** The current examination of the same scope this one corrects. */
    supersedesId: string | null;
    /** Open review requests this examination answers. Only a training examination can. */
    reviewRequestIds: readonly string[];
    details: ExaminationDetailsInput | null;
}

interface ExaminationDetailsBody {
    examinationType?: ApiExaminationType;
    vitals?: Omit<Vitals, "hydration"> & { hydration: ApiHydration };
    assessments?: { area: string; result: ApiAssessmentResult; note: string | null }[];
    recommendations?: string;
    followUpDate?: string;
    scat6?: Scat6Input;
}

export interface ExaminationBody extends ExaminationDetailsBody {
    scope: ExaminationScope;
    decision: ExaminationDecision;
    examinedAt: string;
    reason: string;
    restrictions?: RestrictionListsBody & { notes?: string };
    validUntil?: string;
    supersedesId?: string;
    reviewRequestIds?: string[];
}

/** Details always name their type; empty text is left out, an empty note is null, and only a baseline sends a SCAT6. */
function detailsBody(details: ExaminationDetailsInput): ExaminationDetailsBody {
    const body: ExaminationDetailsBody = { examinationType: upper(details.type) };
    if (details.vitals) body.vitals = { ...details.vitals, hydration: upper(details.vitals.hydration) };
    if (details.assessments.length > 0) {
        body.assessments = details.assessments.map((assessment) => ({ area: assessment.area.trim(), result: upper(assessment.result), note: trimmed(assessment.note) ?? null }));
    }
    const recommendations = trimmed(details.recommendations);
    if (recommendations) body.recommendations = recommendations;
    if (details.followUpDate) body.followUpDate = details.followUpDate;
    if (details.type === "baseline" && details.scat6) body.scat6 = details.scat6;
    return body;
}

/**
 * Restrictions go only with "eligible with restrictions", a validity date never with "not eligible", and review
 * requests only with a training examination: the service rejects any other combination.
 */
export function examinationBody(input: ExaminationDecisionInput): ExaminationBody {
    const body: ExaminationBody = { scope: input.scope, decision: input.decision, examinedAt: input.examinedAt, reason: input.reason.trim() };
    if (input.decision === "ELIGIBLE_WITH_RESTRICTIONS" && input.restrictions) {
        const notes = trimmed(input.restrictions.notes);
        const restrictions = { ...listsBody(input.restrictions), ...(notes ? { notes } : {}) };
        if (Object.keys(restrictions).length > 0) body.restrictions = restrictions;
    }
    if (input.validUntil && input.decision !== "NOT_ELIGIBLE") body.validUntil = input.validUntil;
    if (input.supersedesId) body.supersedesId = input.supersedesId;
    const reviewRequestIds = unique(input.reviewRequestIds);
    if (input.scope === "TRAINING" && reviewRequestIds.length > 0) body.reviewRequestIds = reviewRequestIds;
    return input.details ? { ...body, ...detailsBody(input.details) } : body;
}

/* ─── Clearances ──────────────────────────────────────────────────────────── */

export interface ClearanceInput {
    examinationId: string;
    clearanceType: ClearanceType;
    /** Defaults to now on the service. */
    validFrom: string | null;
    /** Inherits the examination's validity when null. */
    validUntil: string | null;
    /** Inherits the examination's lists when null. */
    restrictions: RestrictionLists | null;
    notes: string | null;
}

export interface ClearanceBody {
    examinationId: string;
    clearanceType: ClearanceType;
    validFrom?: string;
    validUntil?: string;
    restrictions?: RestrictionListsBody;
    notes?: string;
}

export function clearanceBody(input: ClearanceInput): ClearanceBody {
    const body: ClearanceBody = { examinationId: input.examinationId, clearanceType: input.clearanceType };
    if (input.validFrom) body.validFrom = input.validFrom;
    if (input.validUntil) body.validUntil = input.validUntil;
    const restrictions = input.restrictions ? listsBody(input.restrictions) : {};
    if (Object.keys(restrictions).length > 0) body.restrictions = restrictions;
    const notes = trimmed(input.notes);
    if (notes) body.notes = notes;
    return body;
}

/**
 * Lists a clearance would widen compared with its examination. A clearance may only narrow: allow no more session
 * types or techniques than the examination, and keep out at least the joints it excluded.
 */
export function widenedLists(examination: RestrictionLists, clearance: RestrictionLists): RestrictionListName[] {
    const widened: RestrictionListName[] = [];
    const within = <T>(values: readonly T[] | null, allowed: readonly T[] | null) => allowed === null || (values !== null && values.every((value) => allowed.includes(value)));
    if (!within(clearance.allowedSessionTypes, examination.allowedSessionTypes)) widened.push("allowedSessionTypes");
    if (!within(clearance.allowedTechniqueTypes, examination.allowedTechniqueTypes)) widened.push("allowedTechniqueTypes");
    const excluded = examination.excludedJoints;
    if (excluded !== null && !(clearance.excludedJoints !== null && excluded.every((joint) => clearance.excludedJoints?.includes(joint)))) {
        widened.push("excludedJoints");
    }
    return widened;
}

export function revokeClearanceBody(reason: string): { revokedReason: string } {
    return { revokedReason: reason.trim() };
}

/* ─── Injuries & treatments ───────────────────────────────────────────────── */

export interface InjuryInput {
    affectedJoint: BodyJoint;
    injuryType: string;
    severity: ApiInjurySeverity;
    occurredAt: string;
    description: string | null;
}

export function injuryBody(input: InjuryInput) {
    const description = trimmed(input.description);
    return {
        affectedJoint: input.affectedJoint,
        injuryType: input.injuryType.trim(),
        severity: input.severity,
        occurredAt: input.occurredAt,
        ...(description ? { description } : {}),
    };
}

export interface InjuryPatch {
    severity?: ApiInjurySeverity;
    /** An empty description clears it. */
    description?: string | null;
    status?: ApiInjuryStatus;
}

/** Only the fields being changed; the service needs at least one. */
export function injuryUpdateBody(patch: InjuryPatch): { severity?: ApiInjurySeverity; description?: string | null; status?: ApiInjuryStatus } {
    return {
        ...(patch.severity ? { severity: patch.severity } : {}),
        ...(patch.description !== undefined ? { description: trimmed(patch.description) ?? null } : {}),
        ...(patch.status ? { status: patch.status } : {}),
    };
}

export interface TreatmentInput {
    treatmentType: string;
    /** ISO timestamp, not in the future. */
    treatmentDate: string;
    description: string | null;
    outcomeNotes: string | null;
    nextReviewAt: string | null;
}

export function treatmentBody(input: TreatmentInput) {
    const description = trimmed(input.description);
    const outcomeNotes = trimmed(input.outcomeNotes);
    return {
        treatmentType: input.treatmentType.trim(),
        treatmentDate: input.treatmentDate,
        ...(description ? { description } : {}),
        ...(outcomeNotes ? { outcomeNotes } : {}),
        ...(input.nextReviewAt ? { nextReviewAt: input.nextReviewAt } : {}),
    };
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

export interface MilestoneDraft {
    /** Set for a milestone the plan already has; its id is kept however its content or position changes. */
    id?: string;
    title: string;
    criteria: string;
    /** Academy date, YYYY-MM-DD. */
    targetDate: string | null;
    notes: string | null;
    isCompleted: boolean;
}

interface MilestoneBody {
    id?: string;
    title: string;
    criteria: string;
    targetDate?: string | null;
    notes?: string | null;
    isCompleted?: boolean;
}

/** New milestones leave out what the service defaults (no date, no notes, not completed); existing ones send every field. */
function milestoneBody(draft: MilestoneDraft): MilestoneBody {
    const notes = trimmed(draft.notes);
    if (draft.id) {
        return { id: draft.id, title: draft.title.trim(), criteria: draft.criteria.trim(), targetDate: draft.targetDate, notes: notes ?? null, isCompleted: draft.isCompleted };
    }
    return {
        title: draft.title.trim(),
        criteria: draft.criteria.trim(),
        ...(draft.targetDate ? { targetDate: draft.targetDate } : {}),
        ...(notes ? { notes } : {}),
        ...(draft.isCompleted ? { isCompleted: true } : {}),
    };
}

export interface RecoveryPlanInput {
    injuryId: string;
    title: string;
    description: string | null;
    /** YYYY-MM-DD. */
    startDate: string;
    estimatedEndDate: string | null;
    milestones: readonly MilestoneDraft[];
}

export function recoveryPlanBody(input: RecoveryPlanInput) {
    const description = trimmed(input.description);
    return {
        injuryId: input.injuryId,
        title: input.title.trim(),
        ...(description ? { description } : {}),
        startDate: input.startDate,
        ...(input.estimatedEndDate ? { estimatedEndDate: input.estimatedEndDate } : {}),
        // A new plan has no milestones yet, so any id is dropped.
        milestones: input.milestones.map((draft) => milestoneBody({ ...draft, id: undefined })),
    };
}

export interface RecoveryPlanPatch {
    description?: string | null;
    estimatedEndDate?: string | null;
    status?: "COMPLETED" | "CANCELLED";
    /** Replaces the whole list: leave out a milestone and it is removed. */
    milestones?: readonly MilestoneDraft[];
}

export function recoveryPlanUpdateBody(patch: RecoveryPlanPatch) {
    return {
        ...(patch.description !== undefined ? { description: trimmed(patch.description) ?? null } : {}),
        ...(patch.estimatedEndDate !== undefined ? { estimatedEndDate: patch.estimatedEndDate } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.milestones ? { milestones: patch.milestones.map(milestoneBody) } : {}),
    };
}

/** The plan's milestones as drafts that keep their ids, for a replacement that changes only what the doctor touched. */
export function milestoneDrafts(milestones: readonly RecoveryMilestone[]): MilestoneDraft[] {
    return milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        criteria: milestone.criteria,
        targetDate: milestone.targetDate,
        notes: milestone.notes,
        isCompleted: milestone.isCompleted,
    }));
}
