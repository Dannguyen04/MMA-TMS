import { apiFetch } from "./client";
import { withQuery } from "./query";
import type {
  CreateClearanceBody,
  CreateExaminationBody,
  CreateInjuryBody,
  CreateRecoveryPlanBody,
  CreateReviewRequestBody,
  DoctorAssignment,
  ListDoctorAssignmentsQuery,
  ListFightersQuery,
  ListMedicalExaminationsQuery,
  ListMedicalHistoryQuery,
  ListReviewRequestsQuery,
  MedicalClearance,
  MedicalDossier,
  MedicalExamination,
  MedicalHistoryEntry,
  MedicalInjury,
  MedicalReviewRequest,
  Paginated,
  PublicFighter,
  RecoveryPlan,
} from "./types";

export function getFighterMedical(fighterId: string) {
  return apiFetch<MedicalDossier>(`/fighters/${fighterId}/medical`);
}

export function listFighterMedicalHistory(
  fighterId: string,
  query?: ListMedicalHistoryQuery,
) {
  return apiFetch<Paginated<MedicalHistoryEntry>>(
    withQuery(`/fighters/${fighterId}/medical/history`, query),
  );
}

export function listFighterMedicalExaminations(
  fighterId: string,
  query?: ListMedicalExaminationsQuery,
) {
  return apiFetch<Paginated<MedicalExamination>>(
    withQuery(`/fighters/${fighterId}/medical-examinations`, query),
  );
}

export function listFighterReviewRequests(
  fighterId: string,
  query?: ListReviewRequestsQuery,
) {
  return apiFetch<Paginated<MedicalReviewRequest>>(
    withQuery(`/fighters/${fighterId}/medical-review-requests`, query),
  );
}

/** Not idempotent: every successful call creates a new OPEN request. */
export function createFighterReviewRequest(
  fighterId: string,
  body: CreateReviewRequestBody,
) {
  return apiFetch<MedicalReviewRequest>(`/fighters/${fighterId}/medical-review-requests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listFighterDoctors(fighterId: string, query?: ListDoctorAssignmentsQuery) {
  return apiFetch<Paginated<DoctorAssignment>>(
    withQuery(`/fighters/${fighterId}/doctors`, query),
  );
}

/** `doctorId` is the doctor profile id (`sports_doctors.id`), never a hand-typed user id. */
export function assignFighterDoctor(fighterId: string, doctorId: string) {
  return apiFetch<DoctorAssignment>(`/fighters/${fighterId}/doctors`, {
    method: "POST",
    body: JSON.stringify({ doctorId }),
  });
}

/** `doctorId` is the doctor profile id. A doctor may request only their own profile. */
export function listDoctorFighters(doctorId: string, query?: ListFightersQuery) {
  return apiFetch<Paginated<PublicFighter>>(
    withQuery(`/doctors/${doctorId}/fighters`, query),
  );
}

export function createFighterExamination(fighterId: string, body: CreateExaminationBody) {
  return apiFetch<MedicalExamination>(`/fighters/${fighterId}/medical-examinations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function issueFighterClearance(fighterId: string, body: CreateClearanceBody) {
  return apiFetch<MedicalClearance>(`/fighters/${fighterId}/medical-clearances`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createFighterInjury(fighterId: string, body: CreateInjuryBody) {
  return apiFetch<MedicalInjury>(`/fighters/${fighterId}/injuries`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createFighterRecoveryPlan(fighterId: string, body: CreateRecoveryPlanBody) {
  return apiFetch<RecoveryPlan>(`/fighters/${fighterId}/recovery-plans`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
