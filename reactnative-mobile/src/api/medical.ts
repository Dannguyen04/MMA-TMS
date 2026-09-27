import { apiFetch } from "./client";
import { withQuery } from "./query";
import type {
  CreateReviewRequestBody,
  DoctorAssignment,
  ListDoctorAssignmentsQuery,
  ListMedicalExaminationsQuery,
  ListMedicalHistoryQuery,
  ListReviewRequestsQuery,
  MedicalDossier,
  MedicalExamination,
  MedicalHistoryEntry,
  MedicalReviewRequest,
  Paginated,
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
