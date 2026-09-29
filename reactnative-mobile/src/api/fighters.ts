import { apiFetch } from "./client";
import { withQuery } from "./query";
import type {
  AssignCoachBody,
  CoachAssignment,
  CreateMeasurementBody,
  EndCoachAssignmentBody,
  FighterMeasurement,
  FighterMedicalSummary,
  ListFighterSessionsQuery,
  ListFightersQuery,
  ListMeasurementsQuery,
  Paginated,
  PublicFighter,
  TrainingSessionSummary,
  UpdateFighterProfileBody,
} from "./types";

export function listFighters(query?: ListFightersQuery) {
  return apiFetch<Paginated<PublicFighter>>(withQuery("/fighters", query));
}

export function getFighter(fighterId: string) {
  return apiFetch<PublicFighter>(`/fighters/${fighterId}`);
}

export function updateFighter(fighterId: string, body: UpdateFighterProfileBody) {
  return apiFetch<PublicFighter>(`/fighters/${fighterId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listFighterMeasurements(
  fighterId: string,
  query?: ListMeasurementsQuery,
) {
  return apiFetch<Paginated<FighterMeasurement>>(
    withQuery(`/fighters/${fighterId}/measurements`, query),
  );
}

export function createFighterMeasurement(
  fighterId: string,
  body: CreateMeasurementBody,
) {
  return apiFetch<FighterMeasurement>(`/fighters/${fighterId}/measurements`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function supersedeFighterMeasurement(
  fighterId: string,
  measurementId: string,
  body: CreateMeasurementBody,
) {
  return apiFetch<FighterMeasurement>(
    `/fighters/${fighterId}/measurements/${measurementId}/supersede`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function listFighterCoaches(fighterId: string) {
  return apiFetch<CoachAssignment[]>(`/fighters/${fighterId}/coaches`);
}

export function assignFighterCoach(fighterId: string, body: AssignCoachBody) {
  return apiFetch<CoachAssignment>(`/fighters/${fighterId}/coaches`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function endFighterCoachAssignment(
  fighterId: string,
  assignmentId: string,
  body: EndCoachAssignmentBody,
) {
  return apiFetch<CoachAssignment>(
    `/fighters/${fighterId}/coaches/${assignmentId}/end`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function listFighterSessions(
  fighterProfileId: string,
  query?: ListFighterSessionsQuery,
) {
  return apiFetch<Paginated<TrainingSessionSummary>>(
    withQuery(`/fighters/${fighterProfileId}/sessions`, query),
  );
}

export function getFighterMedicalSummary(fighterId: string) {
  return apiFetch<FighterMedicalSummary>(`/fighters/${fighterId}/medical-summary`);
}
