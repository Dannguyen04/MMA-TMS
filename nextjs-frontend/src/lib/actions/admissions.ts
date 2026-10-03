"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authorizeAction, getSessionAccount } from "@/lib/auth/session";
import { ADMISSION_DECISIONS, ADMISSION_LIMITS as LIMITS, ASSESSMENT_CONCLUSIONS, DECISION_LABELS, type Applicant } from "@/lib/domain/admissions";
import { WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import type { User } from "@/lib/domain/types";
import { dashboardPath, routes } from "@/lib/routes";
import { activateFighterAccount, assignEvaluator, decideApplication, resendActivationEmail, submitApplication, submitAssessment } from "@/lib/services/admissions";
import { jsonArray, nullableText, pastDate, requiredText, text } from "./form-helpers";
import { actionError, validationError, writeResultState, type ActionState } from "./state";

/* ─── Applicant ─────────────────────────────────────────────────────────── */

const SIGNED_OUT = "Your session has expired. Sign in again.";

async function signedInApplicant(): Promise<Applicant | null> {
    const account = await getSessionAccount();
    return account?.kind === "applicant" ? account.applicant : null;
}

const applicationSchema = z.object({
    firstName: requiredText("first name", LIMITS.name),
    lastName: requiredText("last name", LIMITS.name),
    dateOfBirth: pastDate("date of birth"),
    weightClass: z.enum(WEIGHT_CLASS_ORDER, "Choose the weight class you compete or train at."),
    nationality: nullableText("nationality", LIMITS.nationality),
    contactPhone: nullableText("phone number", LIMITS.contactPhone),
    trainingBackground: nullableText("training background", LIMITS.background),
    competitionBackground: nullableText("competition background", LIMITS.background),
    motivation: nullableText("motivation", LIMITS.background),
});

/** Sends the signed-in applicant's application to the academy. */
export async function submitApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const applicant = await signedInApplicant();
    if (!applicant) return actionError(SIGNED_OUT);
    const parsed = applicationSchema.safeParse(Object.fromEntries(Object.keys(applicationSchema.shape).map((field) => [field, text(formData, field)])));
    if (!parsed.success) return validationError(parsed.error);

    const result = await submitApplication(applicant, parsed.data);
    if (result.ok) revalidatePath(routes.apply);
    return writeResultState(result, "A coach will be in touch to arrange your assessment.");
}

/** Turns the approved applicant into a fighter and opens their dashboard. */
export async function activateFighterAccountAction(): Promise<ActionState> {
    const applicant = await signedInApplicant();
    if (!applicant) return actionError(SIGNED_OUT);
    const result = await activateFighterAccount(applicant);
    if (!result.ok) return actionError(result.message);
    redirect(dashboardPath("fighter"));
}

/* ─── Administrator ─────────────────────────────────────────────────────── */

const applicationIdSchema = z.string("The application is missing.").min(1, "The application is missing.");

function revalidateApplication(applicationId: string) {
    revalidatePath(routes.admin.admissions);
    revalidatePath(routes.admin.admission(applicationId));
    revalidatePath(routes.coach.admissions);
    revalidatePath(routes.admin.auditLogs);
}

/** Checks the administrator and the application id, then runs the write. */
async function adminWrite(formData: FormData, write: (applicationId: string, actor: User) => Promise<ActionState>): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const applicationId = applicationIdSchema.safeParse(text(formData, "applicationId"));
    if (!applicationId.success) return validationError(applicationId.error);
    return write(applicationId.data, auth.user);
}

/** Picks the coach who assesses the applicant. Replacing a coach needs a reason. */
export async function assignEvaluatorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return adminWrite(formData, async (applicationId, user) => {
        const parsed = z
            .object({ coachId: z.string("Choose a coach.").min(1, "Choose a coach."), reassignmentReason: nullableText("reason", LIMITS.reassignmentReason) })
            .safeParse({ coachId: text(formData, "coachId"), reassignmentReason: text(formData, "reassignmentReason") });
        if (!parsed.success) return validationError(parsed.error);

        const result = await assignEvaluator(applicationId, parsed.data.coachId, parsed.data.reassignmentReason, user);
        if (result.ok) revalidateApplication(applicationId);
        return writeResultState(result, "Coach assigned. They'll see the applicant in their admissions list.");
    });
}

/** Approves or rejects an applicant who passed the assessment. */
export async function decideApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return adminWrite(formData, async (applicationId, user) => {
        const parsed = z
            .object({ decision: z.enum(ADMISSION_DECISIONS, "Choose to approve or reject."), reason: requiredText("reason", LIMITS.decisionReason) })
            .safeParse({ decision: text(formData, "decision"), reason: text(formData, "reason") });
        if (!parsed.success) return validationError(parsed.error);

        const result = await decideApplication(applicationId, parsed.data.decision, parsed.data.reason, user);
        if (result.ok) revalidateApplication(applicationId);
        return writeResultState(
            result,
            parsed.data.decision === "approved" ? "Approved. The applicant gets an email to set their password and activate." : `${DECISION_LABELS.rejected}. The applicant can see the outcome.`,
        );
    });
}

/** Sends the activation email again to an approved applicant who hasn't activated yet. */
export async function resendActivationEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return adminWrite(formData, async (applicationId, user) => {
        const result = await resendActivationEmail(applicationId, user);
        if (result.ok) revalidateApplication(applicationId);
        return writeResultState(result, "Activation email sent again. The link in the previous one stops working.");
    });
}

/* ─── Coach ─────────────────────────────────────────────────────────────── */

const criterionSchema = z.object({
    criterionName: requiredText("criterion", LIMITS.criterionName),
    method: requiredText("method", LIMITS.method),
    observation: requiredText("observation", LIMITS.observation),
    value: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : Number(value)), z.number("Enter a number, or leave it empty.").finite("Enter a number, or leave it empty.").nullable()),
    unit: nullableText("unit", LIMITS.unit),
    note: nullableText("note", LIMITS.note),
});

const assessmentSchema = z.object({
    conclusion: z.enum(ASSESSMENT_CONCLUSIONS, "Choose pass or fail."),
    summary: requiredText("summary", LIMITS.summary),
    criteria: jsonArray(criterionSchema, "criteria", {
        min: LIMITS.criteriaMin,
        minMessage: "Add at least one thing you assessed.",
        max: LIMITS.criteriaMax,
        maxMessage: `Record at most ${LIMITS.criteriaMax} criteria.`,
    }),
});

/** Records the coach's entrance assessment. It can't be changed afterwards. */
export async function submitAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return actionError(auth.message);
    if (auth.user.role !== "coach" || !auth.user.profileId) return actionError("Only coaches assess applicants.");
    const applicationId = applicationIdSchema.safeParse(text(formData, "applicationId"));
    if (!applicationId.success) return validationError(applicationId.error);
    const parsed = assessmentSchema.safeParse({ conclusion: text(formData, "conclusion"), summary: text(formData, "summary"), criteria: text(formData, "criteria") });
    if (!parsed.success) return validationError(parsed.error);

    const result = await submitAssessment(applicationId.data, parsed.data, auth.user);
    if (result.ok) {
        revalidatePath(routes.coach.admissions);
        revalidatePath(routes.coach.admission(applicationId.data));
        revalidatePath(routes.admin.admissions);
    }
    return writeResultState(result, parsed.data.conclusion === "pass" ? "Assessment saved. An administrator will make the final decision." : "Assessment saved. The applicant can see they didn't pass.");
}
