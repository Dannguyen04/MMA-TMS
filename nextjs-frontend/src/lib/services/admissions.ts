import "server-only";

import { z } from "zod";

import { authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import {
    ADMISSION_MESSAGES,
    applicationBody,
    assessmentBody,
    decisionBody,
    evaluatorBody,
    type ActivationStatus,
    type AdmissionDecision,
    type Applicant,
    type Application,
    type ApplicationInput,
    type ApplicationStatus,
    type AssessmentConclusion,
    type AssessmentInput,
    type OwnApplication,
} from "@/lib/domain/admissions";
import type { User, WeightClass } from "@/lib/domain/types";
import type { WriteResult } from "@/lib/domain/write-result";
import { drainNumberedPages, nullIfNotFound, nullIfUnreadable } from "./api-helpers";
import { settleWrite, type ServiceErrorMessages } from "./api-write-errors";
import { weightClassSchema } from "./people";

/*
 * Fighter admissions (`/fighter-admissions/*`): applicants apply and activate, administrators assign the assessing
 * coach and decide, and coaches record the entrance assessment. Each service call keeps to the caller's own surface;
 * the backend checks the role on every route.
 */

async function demoService(): Promise<typeof import("./admissions.demo")> {
    return import("./admissions.demo");
}

const statusSchema = z.enum(["SUBMITTED", "FAILED", "PASSED", "REJECTED", "APPROVED", "ACTIVATED"]);
const activationStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "PASSWORD_SET", "COMPLETED"]);
const conclusionSchema = z.enum(["PASS", "FAIL"]);
const decisionSchema = z.enum(["APPROVED", "REJECTED"]);

const detailsSchema = z.object({
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: z.string(),
    weightClass: weightClassSchema,
    nationality: z.string().nullable(),
    contactPhone: z.string().nullable(),
    trainingBackground: z.string().nullable(),
    competitionBackground: z.string().nullable(),
    motivation: z.string().nullable(),
});

const criterionSchema = z.object({
    criterionName: z.string(),
    method: z.string(),
    observation: z.string(),
    value: z.number().nullish(),
    unit: z.string().nullish(),
    note: z.string().nullish(),
});

/** `applicantApplicationSchema`: outcomes only. */
const ownApplicationSchema = z.object({
    id: z.string(),
    status: statusSchema,
    submittedAt: z.string(),
    applicant: detailsSchema,
    assessment: z.object({ assessedAt: z.string() }).nullable(),
    decision: z.object({ decidedAt: z.string() }).nullable(),
    activation: z.object({ status: activationStatusSchema }).nullable(),
});

/** `staffApplicationSchema`: the full evidence. */
const applicationSchema = z.object({
    id: z.string(),
    guestUserId: z.string(),
    status: statusSchema,
    submittedAt: z.string(),
    applicant: detailsSchema,
    accountEmail: z.string().nullable(),
    currentAssignment: z.object({ coachId: z.string(), startsAt: z.string() }).nullable(),
    assessment: z.object({ coachId: z.string(), conclusion: conclusionSchema, summary: z.string(), criteria: z.array(criterionSchema), assessedAt: z.string() }).nullable(),
    decision: z.object({ decision: decisionSchema, reason: z.string(), decidedAt: z.string() }).nullable(),
    activation: z
        .object({
            status: activationStatusSchema,
            recoveryAttempts: z.number(),
            attemptedAt: z.string().nullable(),
            acceptedAt: z.string().nullable(),
            completedAt: z.string().nullable(),
        })
        .nullable(),
});

const lower = <T extends string>(value: string) => value.toLowerCase() as T;

function adaptDetails(details: z.output<typeof detailsSchema>): Application["applicant"] {
    return { ...details, weightClass: lower<WeightClass>(details.weightClass) };
}

function adaptOwnApplication(input: z.output<typeof ownApplicationSchema>): OwnApplication {
    return {
        id: input.id,
        status: lower<ApplicationStatus>(input.status),
        submittedAt: input.submittedAt,
        applicant: adaptDetails(input.applicant),
        assessedAt: input.assessment?.assessedAt ?? null,
        decidedAt: input.decision?.decidedAt ?? null,
        activation: input.activation ? lower<ActivationStatus>(input.activation.status) : null,
    };
}

function adaptApplication(input: z.output<typeof applicationSchema>): Application {
    const { assessment, decision, activation } = input;
    return {
        id: input.id,
        applicantId: input.guestUserId,
        status: lower<ApplicationStatus>(input.status),
        submittedAt: input.submittedAt,
        applicant: adaptDetails(input.applicant),
        accountEmail: input.accountEmail !== input.applicant.email ? input.accountEmail : null,
        evaluator: input.currentAssignment && { coachId: input.currentAssignment.coachId, since: input.currentAssignment.startsAt },
        assessment: assessment && {
            ...assessment,
            conclusion: lower<AssessmentConclusion>(assessment.conclusion),
            criteria: assessment.criteria.map((criterion) => ({ ...criterion, value: criterion.value ?? null, unit: criterion.unit ?? null, note: criterion.note ?? null })),
        },
        decision: decision && { ...decision, decision: lower<AdmissionDecision>(decision.decision) },
        activation: activation && {
            status: lower<ActivationStatus>(activation.status),
            emailAttempts: activation.recoveryAttempts,
            lastAttemptAt: activation.attemptedAt,
            lastAcceptedAt: activation.acceptedAt,
            completedAt: activation.completedAt,
        },
    };
}

const ADMISSION_ERRORS: ServiceErrorMessages = {
    service: "admissions service",
    forbidden: "You can no longer act on this application. Reload the page.",
    notFound: ADMISSION_MESSAGES.notFound,
    codes: {
        FIGHTER_APPLICATION_NOT_FOUND: ADMISSION_MESSAGES.notFound,
        FIGHTER_APPLICATION_ALREADY_OPEN: ADMISSION_MESSAGES.alreadyOpen,
        FIGHTER_APPLICATION_STATE_CONFLICT: ADMISSION_MESSAGES.movedOn,
        FIGHTER_APPLICATION_COACH_NOT_ASSIGNABLE: ADMISSION_MESSAGES.coachUnavailable,
        FIGHTER_APPLICATION_ASSIGNMENT_LOCKED: ADMISSION_MESSAGES.assignmentLocked,
        FIGHTER_APPLICATION_REASSIGNMENT_REASON_REQUIRED: ADMISSION_MESSAGES.reassignmentReason,
        FIGHTER_APPLICATION_ASSESSMENT_EXISTS: ADMISSION_MESSAGES.assessmentExists,
        FIGHTER_APPLICATION_DECISION_REQUIRES_PASS: ADMISSION_MESSAGES.decisionNeedsPass,
        FIGHTER_APPLICATION_DECISION_EXISTS: ADMISSION_MESSAGES.decisionExists,
        FIGHTER_ACTIVATION_NOT_APPROVED: ADMISSION_MESSAGES.notApproved,
        FIGHTER_ACTIVATION_PASSWORD_NOT_SET: ADMISSION_MESSAGES.passwordNotSet,
        FIGHTER_ACTIVATION_IN_PROGRESS: "Your new password is still being saved. Try again in a minute.",
        FIGHTER_ACTIVATION_STATE_CONFLICT: "Your activation changed at the same time. Reload the page.",
        FIGHTER_ACTIVATION_RESEND_COOLDOWN: "An activation email went out a few minutes ago. Wait before sending another.",
    },
};

const ADMISSION_FIELDS = {
    conflictFields: { FIGHTER_APPLICATION_COACH_NOT_ASSIGNABLE: "coachId", FIGHTER_APPLICATION_REASSIGNMENT_REASON_REQUIRED: "reassignmentReason" },
};

function admissionRequest<T extends z.ZodType>(path: string, schema: T, body?: unknown) {
    return authenticatedMutableApiRequest(path, schema, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

function admissionWrite(path: string, body?: unknown): Promise<WriteResult> {
    return settleWrite(admissionRequest(path, z.unknown(), body), ADMISSION_ERRORS, ADMISSION_FIELDS);
}

/** `recoveryEmailStatusSchema`: whether the email service took the message. It isn't a delivery receipt. */
const recoveryEmailSchema = z.object({ accepted: z.boolean() });

const byNewest = (a: { submittedAt: string }, b: { submittedAt: string }) => b.submittedAt.localeCompare(a.submittedAt);
const applicationPath = (id: string) => `/fighter-admissions/applications/${encodeURIComponent(id)}`;
const assignedPath = (id: string) => `/fighter-admissions/assigned/${encodeURIComponent(id)}`;

/* ─── Applicant ─────────────────────────────────────────────────────────── */

/** The applicant's own applications, newest first. */
export async function listOwnApplications(applicant: Applicant): Promise<OwnApplication[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listOwnApplications(applicant);
    return (await drainNumberedPages("/fighter-admissions/applications/me", ownApplicationSchema)).map(adaptOwnApplication).sort(byNewest);
}

export async function submitApplication(applicant: Applicant, input: ApplicationInput): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).submitApplication(applicant, input);
    return admissionWrite("/fighter-admissions/applications", applicationBody(input));
}

/** Turns an approved applicant whose password is set into a fighter. Running it again once active changes nothing. */
export async function activateFighterAccount(applicant: Applicant): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).activateFighterAccount(applicant);
    return admissionWrite("/fighter-admissions/activation");
}

/* ─── Administrator ─────────────────────────────────────────────────────── */

export async function listApplications(status?: ApplicationStatus): Promise<Application[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listApplications(status);
    const applications = await drainNumberedPages("/fighter-admissions/applications", applicationSchema, { status: status?.toUpperCase() });
    return applications.map(adaptApplication).sort(byNewest);
}

export async function getApplication(id: string): Promise<Application | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getApplication(id);
    const application = await nullIfNotFound(authenticatedApiRequest(applicationPath(id), applicationSchema));
    return application && adaptApplication(application);
}

/** Picks the coach who assesses the applicant; replacing one needs a reason. */
export async function assignEvaluator(id: string, coachId: string, reassignmentReason: string | null, actor: User): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).assignEvaluator(id, coachId, reassignmentReason, actor);
    return admissionWrite(`${applicationPath(id)}/assign-coach`, evaluatorBody(coachId, reassignmentReason));
}

/** Approves or rejects an applicant who passed the assessment. Approval sends the activation email. */
export async function decideApplication(id: string, decision: AdmissionDecision, reason: string, actor: User): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).decideApplication(id, decision, reason, actor);
    return admissionWrite(`${applicationPath(id)}/decision`, decisionBody(decision, reason));
}

/** Sends the activation email again. The service answers 200 even when the email service refuses it, so check. */
export async function resendActivationEmail(id: string, actor: User): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).resendActivationEmail(id, actor);
    const reply = admissionRequest(`${applicationPath(id)}/resend-activation-email`, recoveryEmailSchema);
    const result = await settleWrite(reply, ADMISSION_ERRORS, ADMISSION_FIELDS);
    if (!result.ok) return result;
    return (await reply).accepted ? result : { ok: false, message: ADMISSION_MESSAGES.emailNotAccepted };
}

/* ─── Coach ─────────────────────────────────────────────────────────────── */

/** Applications the signed-in coach is assessing or has assessed. */
export async function listAssignedApplications(coach: User): Promise<Application[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listAssignedApplications(coach);
    return (await drainNumberedPages("/fighter-admissions/assigned", applicationSchema)).map(adaptApplication).sort(byNewest);
}

export async function getAssignedApplication(id: string, coach: User): Promise<Application | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getAssignedApplication(id, coach);
    // An application that isn't (or is no longer) theirs is refused (403); it reads as missing.
    const application = await nullIfUnreadable(authenticatedApiRequest(assignedPath(id), applicationSchema));
    return application && adaptApplication(application);
}

export async function submitAssessment(id: string, input: AssessmentInput, coach: User): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).submitAssessment(id, input, coach);
    return admissionWrite(`${assignedPath(id)}/assessment`, assessmentBody(input));
}
