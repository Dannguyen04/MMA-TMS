import type { WeightClass } from "./types";

/**
 * Fighter admissions. Someone registers as an applicant and applies; an administrator picks a coach to assess them;
 * the coach records the entrance assessment; an administrator approves or rejects a passed application; and the
 * approved applicant sets a password from the activation email and activates their fighter account. Shared by both
 * services, the actions and the pages, with the request bodies built from input a form has already validated. Safe
 * for Server and Client Components.
 */

export type ApplicationStatus = "submitted" | "failed" | "passed" | "rejected" | "approved" | "activated";
export type ActivationStatus = "pending" | "in_progress" | "password_set" | "completed";
export type AssessmentConclusion = "pass" | "fail";
export type AdmissionDecision = "approved" | "rejected";

export const APPLICATION_STATUSES = ["submitted", "passed", "approved", "activated", "failed", "rejected"] as const satisfies readonly ApplicationStatus[];
export const ASSESSMENT_CONCLUSIONS = ["pass", "fail"] as const satisfies readonly AssessmentConclusion[];
export const ADMISSION_DECISIONS = ["approved", "rejected"] as const satisfies readonly AdmissionDecision[];

/** Applications still in progress. An applicant holds at most one; closed ones stay as history. */
const OPEN_STATUSES: readonly ApplicationStatus[] = ["submitted", "passed", "approved"];

/** A signed-in applicant: an account that can apply to the academy but isn't a fighter yet. */
export interface Applicant {
    id: string;
    email: string;
}

/** What the applicant told the academy, as submitted. */
export interface ApplicantDetails {
    /** The account email when they applied. */
    email: string;
    firstName: string;
    lastName: string;
    /** YYYY-MM-DD. */
    dateOfBirth: string;
    weightClass: WeightClass;
    nationality: string | null;
    contactPhone: string | null;
    trainingBackground: string | null;
    competitionBackground: string | null;
    motivation: string | null;
}

/** One thing the coach checked, in their own words; a measured value keeps its unit. */
export interface AssessmentCriterion {
    criterionName: string;
    method: string;
    observation: string;
    value: number | null;
    unit: string | null;
    note: string | null;
}

/** What an applicant sees of their own application: outcomes only, never staff notes. */
export interface OwnApplication {
    id: string;
    status: ApplicationStatus;
    submittedAt: string;
    applicant: ApplicantDetails;
    assessedAt: string | null;
    decidedAt: string | null;
    activation: ActivationStatus | null;
}

/** What staff see: the full evidence for the people allowed to act on the application. */
export interface Application {
    id: string;
    /** The applicant's account. */
    applicantId: string;
    status: ApplicationStatus;
    submittedAt: string;
    applicant: ApplicantDetails;
    /** The account's email now, when it changed after applying; activation mail goes here. */
    accountEmail: string | null;
    /** The coach currently assessing the applicant, by coach profile id. */
    evaluator: { coachId: string; since: string } | null;
    assessment: { coachId: string; conclusion: AssessmentConclusion; summary: string; criteria: AssessmentCriterion[]; assessedAt: string } | null;
    decision: { decision: AdmissionDecision; reason: string; decidedAt: string } | null;
    activation: { status: ActivationStatus; emailsSent: number; lastEmailAt: string | null; completedAt: string | null } | null;
}

/** Limits the admissions service enforces, mirrored on the forms. */
export const ADMISSION_LIMITS = {
    name: 100,
    nationality: 100,
    contactPhone: 32,
    background: 2000,
    reassignmentReason: 500,
    decisionReason: 2000,
    summary: 4000,
    criterionName: 150,
    method: 300,
    observation: 1000,
    unit: 30,
    note: 1000,
    criteriaMin: 1,
    criteriaMax: 30,
} as const;

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
    submitted: "Awaiting assessment",
    passed: "Passed assessment",
    approved: "Approved",
    activated: "Fighter account active",
    failed: "Did not pass",
    rejected: "Not admitted",
};

export const ACTIVATION_STATUS_LABELS: Record<ActivationStatus, string> = {
    pending: "Waiting for a new password",
    in_progress: "Setting a password",
    password_set: "Ready to activate",
    completed: "Activated",
};

export const CONCLUSION_LABELS: Record<AssessmentConclusion, string> = { pass: "Pass", fail: "Fail" };

export const DECISION_LABELS: Record<AdmissionDecision, string> = { approved: "Approved", rejected: "Rejected" };

/** Refusals both services explain the same way. */
export const ADMISSION_MESSAGES = {
    notFound: "This application no longer exists. Reload the page.",
    alreadyOpen: "You already have an application in progress. Reload the page to see it.",
    movedOn: "The application has moved on since the page loaded. Reload the page.",
    coachUnavailable: "That coach can't assess applicants right now. Choose another.",
    assignmentLocked: "The assessing coach can't change once the assessment is recorded.",
    reassignmentReason: "Say why you're replacing the assessing coach.",
    assessmentExists: "The assessment has already been recorded. Reload the page.",
    decisionNeedsPass: "Only an applicant who passed the assessment can be approved or rejected.",
    decisionExists: "A decision has already been recorded. Reload the page.",
    notApproved: "There's no approved application to activate. Reload the page.",
    passwordNotSet: "Set your password from the activation email first, then sign in again and activate.",
} as const;

export const applicantName = (details: Pick<ApplicantDetails, "firstName" | "lastName">) => `${details.firstName} ${details.lastName}`;

export function isOpenApplication(application: { status: ApplicationStatus }): boolean {
    return OPEN_STATUSES.includes(application.status);
}

/** The application in progress, if any. */
export function openApplication<T extends { status: ApplicationStatus }>(applications: T[]): T | null {
    return applications.find(isOpenApplication) ?? null;
}

/** The applicant's view of an application: outcomes and dates, without the coach's or administrator's notes. */
export function toOwnApplication(application: Application): OwnApplication {
    return {
        id: application.id,
        status: application.status,
        submittedAt: application.submittedAt,
        applicant: application.applicant,
        assessedAt: application.assessment?.assessedAt ?? null,
        decidedAt: application.decision?.decidedAt ?? null,
        activation: application.activation?.status ?? null,
    };
}

export type ApplicationInput = Omit<ApplicantDetails, "email">;

/** The answers an applicant gave, to start a new application from. */
export function applicationAnswers(details: ApplicantDetails): ApplicationInput {
    const { firstName, lastName, dateOfBirth, weightClass, nationality, contactPhone, trainingBackground, competitionBackground, motivation } = details;
    return { firstName, lastName, dateOfBirth, weightClass, nationality, contactPhone, trainingBackground, competitionBackground, motivation };
}

export interface AssessmentInput {
    conclusion: AssessmentConclusion;
    summary: string;
    criteria: AssessmentCriterion[];
}

const optional = (value: string | null) => value?.trim() || null;

/** `POST /fighter-admissions/applications`. The email comes from the signed-in account, never the form. */
export function applicationBody(input: ApplicationInput) {
    return {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        dateOfBirth: input.dateOfBirth,
        weightClass: input.weightClass.toUpperCase(),
        nationality: optional(input.nationality),
        contactPhone: optional(input.contactPhone),
        trainingBackground: optional(input.trainingBackground),
        competitionBackground: optional(input.competitionBackground),
        motivation: optional(input.motivation),
    };
}

/** `POST /fighter-admissions/applications/:id/assign-coach`. A reason is needed only when replacing the coach. */
export function evaluatorBody(coachId: string, reassignmentReason: string | null) {
    const reason = optional(reassignmentReason);
    return reason ? { coachId, reassignmentReason: reason } : { coachId };
}

/** `POST /fighter-admissions/assigned/:id/assessment`. */
export function assessmentBody(input: AssessmentInput) {
    return {
        conclusion: input.conclusion.toUpperCase(),
        summary: input.summary.trim(),
        criteria: input.criteria.map((criterion) => ({
            criterionName: criterion.criterionName.trim(),
            method: criterion.method.trim(),
            observation: criterion.observation.trim(),
            value: criterion.value,
            unit: optional(criterion.unit),
            note: optional(criterion.note),
        })),
    };
}

/** `POST /fighter-admissions/applications/:id/decision`. */
export function decisionBody(decision: AdmissionDecision, reason: string) {
    return { decision: decision.toUpperCase(), reason: reason.trim() };
}
