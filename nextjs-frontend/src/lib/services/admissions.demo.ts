import "server-only";

import {
    ADMISSION_MESSAGES,
    applicantName,
    openApplication,
    toOwnApplication,
    type AdmissionDecision,
    type Applicant,
    type Application,
    type ApplicationInput,
    type ApplicationStatus,
    type AssessmentInput,
    type OwnApplication,
} from "@/lib/domain/admissions";
import { WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { User } from "@/lib/domain/types";
import type { WriteResult } from "@/lib/domain/write-result";
import { dayKey } from "@/lib/format";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import { routes } from "@/lib/routes";
import { recordAudit } from "./audit.demo";
import { notifyUsers } from "./notifications.demo";

/*
 * Admissions on the in-memory store. The demo has no email step: an approved application is ready to activate
 * straight away, and activating turns the applicant's account into a fighter with a new profile.
 */

const refused = (message: string, field?: string): WriteResult => ({ ok: false, message, ...(field ? { fieldErrors: { [field]: message } } : {}) });
const byNewest = (a: Application, b: Application) => b.submittedAt.localeCompare(a.submittedAt);

function audit(actor: User | null, action: string, application: Application, details?: string) {
    recordAudit({ actor, action, resourceType: "user", resourceId: application.applicantId, resourceLabel: applicantName(application.applicant), details });
}

/* Notifications as the admission service sends them; whoever acted isn't told about their own step. */

function notifyAdmins(title: string, body: string, href: string) {
    const userIds = db().users.filter((user) => user.role === "admin" && user.status === "active").map((user) => user.id);
    if (userIds.length > 0) notifyUsers({ userIds, category: "admission", title, body, href });
}

function notifyApplicant(application: Application, title: string, body: string, severity: "success" | "warning") {
    notifyUsers({ userIds: [application.applicantId], category: "admission", severity, title, body, href: routes.apply });
}

/* ─── Applicant ─────────────────────────────────────────────────────────── */

export async function listOwnApplications(applicant: Applicant): Promise<OwnApplication[]> {
    await simulateLatency();
    return db()
        .admissionApplications.filter((application) => application.applicantId === applicant.id)
        .sort(byNewest)
        .map(toOwnApplication);
}

export async function submitApplication(applicant: Applicant, input: ApplicationInput): Promise<WriteResult> {
    await simulateLatency();
    const store = db();
    if (openApplication(store.admissionApplications.filter((application) => application.applicantId === applicant.id))) return refused(ADMISSION_MESSAGES.alreadyOpen);
    const application: Application = {
        id: newId("app"),
        applicantId: applicant.id,
        status: "submitted",
        submittedAt: nowIso(),
        applicant: { ...input, email: applicant.email },
        accountEmail: null,
        evaluator: null,
        assessment: null,
        decision: null,
        activation: null,
    };
    store.admissionApplications.push(application);
    audit(null, "admission.apply", application);
    notifyAdmins("New fighter application", `${applicantName(application.applicant)} applied to train. Assign a coach to assess them.`, routes.admin.admission(application.id));
    return { ok: true };
}

export async function activateFighterAccount(applicant: Applicant): Promise<WriteResult> {
    await simulateLatency();
    const store = db();
    const application = store.admissionApplications.find((candidate) => candidate.applicantId === applicant.id && candidate.status === "approved");
    if (!application?.activation) return refused(ADMISSION_MESSAGES.notApproved);
    if (application.activation.status !== "password_set") return refused(ADMISSION_MESSAGES.passwordNotSet);

    // The account keeps its id, so the signed-in session carries on as the new fighter.
    const now = nowIso();
    const { dateOfBirth, weightClass, nationality } = application.applicant;
    const name = applicantName(application.applicant);
    const fighterId = newId("f");
    store.fighters.push({
        id: fighterId,
        userId: applicant.id,
        name,
        nickname: null,
        sex: null,
        dateOfBirth,
        nationality,
        heightCm: null,
        reachCm: null,
        weightKg: null,
        targetWeightKg: WEIGHT_CLASS_LIMIT_KG[weightClass],
        bodyFatPct: null,
        restingHeartRate: null,
        weightClass,
        stance: null,
        level: null,
        primaryDiscipline: null,
        record: null,
        coachIds: [],
        primaryCoachId: null,
        doctorIds: [],
        healthStatus: "healthy",
        joinedAt: dayKey(now),
        upcomingBout: null,
    });
    const user: User = { id: applicant.id, email: applicant.email, name, role: "fighter", title: "Fighter", phone: null, status: "active", createdAt: now, lastActiveAt: now, profileId: fighterId };
    store.users.push(user);
    store.applicants = store.applicants.filter((candidate) => candidate.id !== applicant.id);
    application.status = "activated";
    application.activation = { ...application.activation, status: "completed", completedAt: now };
    audit(user, "admission.activate", application);
    notifyAdmins("New Fighter activated", `${name} activated their fighter account. Assign a coach and a sports doctor.`, routes.admin.userCareTeam(user.id));
    return { ok: true };
}

/* ─── Administrator ─────────────────────────────────────────────────────── */

export async function listApplications(status?: ApplicationStatus): Promise<Application[]> {
    await simulateLatency();
    return db()
        .admissionApplications.filter((application) => !status || application.status === status)
        .sort(byNewest);
}

export async function getApplication(id: string): Promise<Application | null> {
    await simulateLatency();
    return db().admissionApplications.find((application) => application.id === id) ?? null;
}

export async function assignEvaluator(id: string, coachId: string, reassignmentReason: string | null, actor: User): Promise<WriteResult> {
    await simulateLatency();
    const store = db();
    const application = store.admissionApplications.find((candidate) => candidate.id === id);
    if (!application) return refused(ADMISSION_MESSAGES.notFound);
    if (application.assessment) return refused(ADMISSION_MESSAGES.assignmentLocked);
    if (application.status !== "submitted") return refused(ADMISSION_MESSAGES.movedOn);
    const coach = store.coaches.find((candidate) => candidate.id === coachId);
    if (!coach) return refused(ADMISSION_MESSAGES.coachUnavailable, "coachId");
    if (application.evaluator?.coachId === coachId) return { ok: true };
    if (application.evaluator && !reassignmentReason) return refused(ADMISSION_MESSAGES.reassignmentReason, "reassignmentReason");

    application.evaluator = { coachId, since: nowIso() };
    audit(actor, "admission.assign_coach", application, reassignmentReason ? `${coach.name} now assessing: ${reassignmentReason}` : `${coach.name} assessing`);
    if (coach.userId && coach.userId !== actor.id) {
        notifyUsers({
            userIds: [coach.userId],
            category: "admission",
            title: "Application assigned to you",
            body: `Assess ${applicantName(application.applicant)} for the fighter programme.`,
            href: routes.coach.admission(application.id),
        });
    }
    return { ok: true };
}

export async function decideApplication(id: string, decision: AdmissionDecision, reason: string, actor: User): Promise<WriteResult> {
    await simulateLatency();
    const application = db().admissionApplications.find((candidate) => candidate.id === id);
    if (!application) return refused(ADMISSION_MESSAGES.notFound);
    if (application.decision) return refused(ADMISSION_MESSAGES.decisionExists);
    if (application.status !== "passed") return refused(ADMISSION_MESSAGES.decisionNeedsPass);

    const now = nowIso();
    application.decision = { decision, reason, decidedAt: now };
    application.status = decision;
    if (decision === "approved") application.activation = { status: "password_set", emailAttempts: 1, lastAttemptAt: now, lastAcceptedAt: now, completedAt: null };
    audit(actor, `admission.${decision === "approved" ? "approve" : "reject"}`, application, reason);
    if (decision === "approved") notifyApplicant(application, "Application approved", "Welcome to the academy. Activate your fighter account from your application.", "success");
    else notifyApplicant(application, "Application not admitted", "The academy decided not to admit you this time. See your application for details.", "warning");
    return { ok: true };
}

export async function resendActivationEmail(id: string, actor: User): Promise<WriteResult> {
    await simulateLatency();
    const application = db().admissionApplications.find((candidate) => candidate.id === id);
    if (!application) return refused(ADMISSION_MESSAGES.notFound);
    if (application.status !== "approved" || !application.activation) return refused(ADMISSION_MESSAGES.movedOn);

    const now = nowIso();
    application.activation = { ...application.activation, emailAttempts: application.activation.emailAttempts + 1, lastAttemptAt: now, lastAcceptedAt: now };
    audit(actor, "admission.resend_activation", application);
    return { ok: true };
}

/* ─── Coach ─────────────────────────────────────────────────────────────── */

export async function listAssignedApplications(coach: User): Promise<Application[]> {
    await simulateLatency();
    return db()
        .admissionApplications.filter((application) => application.evaluator?.coachId === coach.profileId)
        .sort(byNewest);
}

export async function getAssignedApplication(id: string, coach: User): Promise<Application | null> {
    await simulateLatency();
    return db().admissionApplications.find((application) => application.id === id && application.evaluator?.coachId === coach.profileId) ?? null;
}

export async function submitAssessment(id: string, input: AssessmentInput, coach: User): Promise<WriteResult> {
    await simulateLatency();
    const application = db().admissionApplications.find((candidate) => candidate.id === id);
    if (!application || !coach.profileId || application.evaluator?.coachId !== coach.profileId) return refused(ADMISSION_MESSAGES.notFound);
    if (application.assessment) return refused(ADMISSION_MESSAGES.assessmentExists);
    if (application.status !== "submitted") return refused(ADMISSION_MESSAGES.movedOn);

    application.assessment = { ...input, coachId: coach.profileId, assessedAt: nowIso() };
    application.status = input.conclusion === "pass" ? "passed" : "failed";
    audit(coach, "admission.assess", application, input.conclusion === "pass" ? "Passed the assessment" : "Did not pass the assessment");
    if (input.conclusion === "pass") {
        notifyApplicant(application, "Assessment passed", "You passed the entrance assessment. The academy makes the final decision next.", "success");
        notifyAdmins("Application awaiting decision", `${applicantName(application.applicant)} passed the assessment.`, routes.admin.admission(application.id));
    } else {
        notifyApplicant(application, "Assessment not passed", "You didn't pass the entrance assessment this time. You can apply again.", "warning");
    }
    return { ok: true };
}
