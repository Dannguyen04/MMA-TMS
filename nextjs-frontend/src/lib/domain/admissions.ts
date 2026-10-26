import { trimToNull } from "@/lib/utils";
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
    /** The activation emails: how often one was sent, and when the email service last took one (not a delivery receipt). */
    activation: { status: ActivationStatus; emailAttempts: number; lastAttemptAt: string | null; lastAcceptedAt: string | null; completedAt: string | null } | null;
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
    pending: "Waiting to set a password",
    in_progress: "Setting a password",
    password_set: "Ready to activate",
    completed: "Activated",
};

/** `?notice=` on the fighter Today page right after the applicant activated their fighter account. */
export const ACTIVATED_NOTICE = "activated";

/** `?notice=` on the application page when the set-up link chose the password in a browser still signed in as the applicant. */
export const PASSWORD_SET_NOTICE = "password-set";

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
    emailNotAccepted: "The email service didn't take the activation email. Wait a few minutes, then try again.",
} as const;

export const applicantName = (details: Pick<ApplicantDetails, "firstName" | "lastName">) => `${details.firstName} ${details.lastName}`;

export function isOpenApplication(application: { status: ApplicationStatus }): boolean {
    return OPEN_STATUSES.includes(application.status);
}

/** The application in progress, if any. */
export function openApplication<T extends { status: ApplicationStatus }>(applications: T[]): T | null {
    return applications.find(isOpenApplication) ?? null;
}

/** Whether the applicant was approved and still has to set their first password or activate. */
export function awaitsFighterActivation(applications: Pick<OwnApplication, "status" | "activation">[]): boolean {
    const open = openApplication(applications);
    return open?.status === "approved" && open.activation !== "completed";
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

/* ─── The applicant's journey ─────────────────────────────────────────────── */

export type JourneyStepId = "email" | "application" | "assessment" | "decision" | "password" | "activation" | "doctor" | "baseline" | "cleared";

/** `ended` is where a closed application stopped: the assessment it failed or the decision that turned it down. */
export type JourneyStepState = "done" | "current" | "upcoming" | "ended";

export interface JourneyStep {
    id: JourneyStepId;
    label: string;
    state: JourneyStepState;
    /** When the step happened, when the applicant may know it. */
    date: string | null;
    /** `admission` steps happen here; `fighter` steps happen in the fighter account after activation. */
    phase: "admission" | "fighter";
    /** The outcome of an `ended` step, e.g. "Did not pass". */
    outcome: string | null;
}

const JOURNEY_LABELS: Record<JourneyStepId, string> = {
    email: "Email verified",
    application: "Application",
    assessment: "Coach assessment",
    decision: "Decision",
    password: "Set password",
    activation: "Activate",
    doctor: "Doctor assigned",
    baseline: "Baseline exam",
    cleared: "Cleared to train",
};

const ADMISSION_STEPS: JourneyStepId[] = ["email", "application", "assessment", "decision", "password", "activation"];
const FIGHTER_STEPS: JourneyStepId[] = ["doctor", "baseline", "cleared"];

/**
 * The whole way from a verified email to training, from what the applicant may read of their own application.
 * The fighter steps (doctor, baseline exam, clearance) happen after activation, in the fighter account, so they are
 * always still to come here. A failed or rejected application ends at that step.
 */
export function applicantJourney(application: OwnApplication): JourneyStep[] {
    const { status, activation } = application;
    const activated = status === "activated" || activation === "completed";
    const passwordSet = activated || activation === "password_set";
    const done: Record<JourneyStepId, boolean> = {
        email: true,
        application: true,
        assessment: application.assessedAt !== null || status !== "submitted",
        decision: application.decidedAt !== null || status === "approved" || status === "activated" || status === "rejected",
        password: passwordSet,
        activation: activated,
        doctor: false,
        baseline: false,
        cleared: false,
    };
    const dates: Partial<Record<JourneyStepId, string | null>> = {
        application: application.submittedAt,
        assessment: application.assessedAt,
        decision: application.decidedAt,
    };
    const endedAt: JourneyStepId | null = status === "failed" ? "assessment" : status === "rejected" ? "decision" : null;
    const current = endedAt ? null : (ADMISSION_STEPS.find((id) => !done[id]) ?? null);

    const steps: JourneyStep[] = [];
    for (const id of [...ADMISSION_STEPS, ...FIGHTER_STEPS]) {
        const ended = id === endedAt;
        steps.push({
            id,
            label: JOURNEY_LABELS[id],
            state: ended ? "ended" : done[id] ? "done" : id === current ? "current" : "upcoming",
            date: dates[id] ?? null,
            phase: FIGHTER_STEPS.includes(id) ? "fighter" : "admission",
            outcome: ended ? APPLICATION_STATUS_LABELS[status] : null,
        });
        if (ended) break;
    }
    return steps;
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

/** `POST /fighter-admissions/applications`. The email comes from the signed-in account, never the form. */
export function applicationBody(input: ApplicationInput) {
    return {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        dateOfBirth: input.dateOfBirth,
        weightClass: input.weightClass.toUpperCase(),
        nationality: trimToNull(input.nationality),
        contactPhone: trimToNull(input.contactPhone),
        trainingBackground: trimToNull(input.trainingBackground),
        competitionBackground: trimToNull(input.competitionBackground),
        motivation: trimToNull(input.motivation),
    };
}

/** `POST /fighter-admissions/applications/:id/assign-coach`. A reason is needed only when replacing the coach. */
export function evaluatorBody(coachId: string, reassignmentReason: string | null) {
    const reason = trimToNull(reassignmentReason);
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
            unit: trimToNull(criterion.unit),
            note: trimToNull(criterion.note),
        })),
    };
}

/** `POST /fighter-admissions/applications/:id/decision`. */
export function decisionBody(decision: AdmissionDecision, reason: string) {
    return { decision: decision.toUpperCase(), reason: reason.trim() };
}
