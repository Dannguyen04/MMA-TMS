import { apiFetch } from "./client";
import { withQuery } from "./query";
import type { WeightClass } from "@/constants/weight-classes";

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "FAILED",
  "PASSED",
  "REJECTED",
  "APPROVED",
  "ACTIVATED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const ACTIVATION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PASSWORD_SET",
  "COMPLETED",
] as const;
export type ActivationStatus = (typeof ACTIVATION_STATUSES)[number];

export const ASSESSMENT_CONCLUSIONS = ["PASS", "FAIL"] as const;
export type AssessmentConclusion = (typeof ASSESSMENT_CONCLUSIONS)[number];

export const ADMIN_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type AdminDecision = (typeof ADMIN_DECISIONS)[number];

export type ApplicationSnapshot = {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  weightClass: WeightClass;
  nationality: string | null;
  contactPhone: string | null;
  trainingBackground: string | null;
  competitionBackground: string | null;
  motivation: string | null;
};

export type ApplicantApplication = {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  applicant: ApplicationSnapshot;
  assessment: { conclusion: AssessmentConclusion; assessedAt: string } | null;
  decision: { decision: AdminDecision; decidedAt: string } | null;
  activation: { status: ActivationStatus } | null;
};

export type CoachAssignmentPeriod = {
  id: string;
  coachId: string;
  assignedById: string;
  startsAt: string;
  endsAt: string | null;
  endedById: string | null;
  endReason: string | null;
};

export type AssessmentCriterion = {
  criterionName: string;
  method: string;
  observation: string;
  value?: number | null;
  unit?: string | null;
  note?: string | null;
};

export type StaffApplication = {
  id: string;
  guestUserId: string;
  status: ApplicationStatus;
  submittedAt: string;
  applicant: ApplicationSnapshot;
  accountEmail: string | null;
  currentAssignment: CoachAssignmentPeriod | null;
  assignmentHistory: CoachAssignmentPeriod[];
  assessment: {
    id: string;
    coachId: string;
    conclusion: AssessmentConclusion;
    summary: string;
    criteria: AssessmentCriterion[];
    assessedAt: string;
  } | null;
  decision: {
    id: string;
    adminId: string;
    decision: AdminDecision;
    reason: string;
    decidedAt: string;
  } | null;
  activation: {
    status: ActivationStatus;
    recoveryAttempts: number;
    attemptedAt: string | null;
    acceptedAt: string | null;
    completedAt: string | null;
  } | null;
};

export type AdmissionPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type SubmitApplicationBody = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  weightClass: WeightClass;
  nationality?: string | null;
  contactPhone?: string | null;
  trainingBackground?: string | null;
  competitionBackground?: string | null;
  motivation?: string | null;
};

export type ListOwnApplicationsQuery = {
  page?: number;
  limit?: number;
};

export type ListApplicationsQuery = ListOwnApplicationsQuery & {
  status?: ApplicationStatus;
};

export type AssignCoachBody = {
  coachId: string;
  reassignmentReason?: string | null;
};

export type SubmitAssessmentBody = {
  conclusion: AssessmentConclusion;
  summary: string;
  criteria: AssessmentCriterion[];
};

export type SubmitDecisionBody = {
  decision: AdminDecision;
  reason: string;
};

export type ActivationResponse = {
  applicationId: string;
  status: ActivationStatus;
  role: "FIGHTER";
  alreadyActive: boolean;
};

export type RecoveryEmailStatus = {
  applicationId: string;
  accepted: boolean;
  recoveryAttempts: number;
  attemptedAt: string;
};

export function submitApplication(body: SubmitApplicationBody) {
  return apiFetch<ApplicantApplication>("/fighter-admissions/applications", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listOwnApplications(query?: ListOwnApplicationsQuery) {
  return apiFetch<AdmissionPage<ApplicantApplication>>(
    withQuery("/fighter-admissions/applications/me", query),
  );
}

export function getOwnApplication(id: string) {
  return apiFetch<ApplicantApplication>(
    `/fighter-admissions/applications/me/${encodeURIComponent(id)}`,
  );
}

export function activateAdmission() {
  return apiFetch<ActivationResponse>("/fighter-admissions/activation", {
    method: "POST",
  });
}

export function listApplications(query?: ListApplicationsQuery) {
  return apiFetch<AdmissionPage<StaffApplication>>(
    withQuery("/fighter-admissions/applications", query),
  );
}

export function getApplication(id: string) {
  return apiFetch<StaffApplication>(
    `/fighter-admissions/applications/${encodeURIComponent(id)}`,
  );
}

export function assignApplicationCoach(id: string, body: AssignCoachBody) {
  return apiFetch<StaffApplication>(
    `/fighter-admissions/applications/${encodeURIComponent(id)}/assign-coach`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function decideApplication(id: string, body: SubmitDecisionBody) {
  return apiFetch<StaffApplication>(
    `/fighter-admissions/applications/${encodeURIComponent(id)}/decision`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function resendActivationEmail(id: string) {
  return apiFetch<RecoveryEmailStatus>(
    `/fighter-admissions/applications/${encodeURIComponent(id)}/resend-activation-email`,
    { method: "POST" },
  );
}

export function listAssignedApplications(query?: ListApplicationsQuery) {
  return apiFetch<AdmissionPage<StaffApplication>>(
    withQuery("/fighter-admissions/assigned", query),
  );
}

export function getAssignedApplication(id: string) {
  return apiFetch<StaffApplication>(
    `/fighter-admissions/assigned/${encodeURIComponent(id)}`,
  );
}

export function submitAssessment(id: string, body: SubmitAssessmentBody) {
  return apiFetch<StaffApplication>(
    `/fighter-admissions/assigned/${encodeURIComponent(id)}/assessment`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
