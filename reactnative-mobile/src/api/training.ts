import { apiFetch } from "./client";
import { withQuery } from "./query";
import type {
  CreateExerciseBody,
  CreatePlanExerciseBody,
  CreateTrainingPlanBody,
  CreateTrainingSessionBody,
  Exercise,
  ListExercisesQuery,
  ListTrainingPlansQuery,
  ListTrainingSessionsQuery,
  Paginated,
  RemovedPlanExercise,
  TrainingPlan,
  TrainingPlanExercise,
  TrainingSession,
  UpdateExerciseBody,
  UpdatePlanExerciseBody,
  UpdateTrainingPlanBody,
  UpdateTrainingPlanStatusBody,
  UpdateTrainingSessionBody,
  UpdateTrainingSessionStatusBody,
} from "./types";

export function listTrainingPlans(query?: ListTrainingPlansQuery) {
  return apiFetch<Paginated<TrainingPlan>>(withQuery("/training-plans", query));
}

export function createTrainingPlan(body: CreateTrainingPlanBody) {
  return apiFetch<TrainingPlan>("/training-plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getTrainingPlan(planId: string) {
  return apiFetch<TrainingPlan>(`/training-plans/${planId}`);
}

export function updateTrainingPlan(planId: string, body: UpdateTrainingPlanBody) {
  return apiFetch<TrainingPlan>(`/training-plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateTrainingPlanStatus(
  planId: string,
  body: UpdateTrainingPlanStatusBody,
) {
  return apiFetch<TrainingPlan>(`/training-plans/${planId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listTrainingPlanExercises(planId: string) {
  return apiFetch<TrainingPlanExercise[]>(`/training-plans/${planId}/exercises`);
}

export function addTrainingPlanExercise(
  planId: string,
  body: CreatePlanExerciseBody,
) {
  return apiFetch<TrainingPlanExercise>(`/training-plans/${planId}/exercises`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTrainingPlanExercise(
  planId: string,
  exerciseId: string,
  body: UpdatePlanExerciseBody,
) {
  return apiFetch<TrainingPlanExercise>(
    `/training-plans/${planId}/exercises/${exerciseId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function removeTrainingPlanExercise(planId: string, exerciseId: string) {
  return apiFetch<RemovedPlanExercise>(
    `/training-plans/${planId}/exercises/${exerciseId}`,
    { method: "DELETE" },
  );
}

export function listTrainingSessions(query?: ListTrainingSessionsQuery) {
  return apiFetch<Paginated<TrainingSession>>(
    withQuery("/training-sessions", query),
  );
}

export function createTrainingSession(body: CreateTrainingSessionBody) {
  return apiFetch<TrainingSession>("/training-sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getTrainingSession(sessionId: string) {
  return apiFetch<TrainingSession>(`/training-sessions/${sessionId}`);
}

export function updateTrainingSession(
  sessionId: string,
  body: UpdateTrainingSessionBody,
) {
  return apiFetch<TrainingSession>(`/training-sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateTrainingSessionStatus(
  sessionId: string,
  body: UpdateTrainingSessionStatusBody,
) {
  return apiFetch<TrainingSession>(`/training-sessions/${sessionId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listExercises(query?: ListExercisesQuery) {
  return apiFetch<Paginated<Exercise>>(withQuery("/exercises", query));
}

export function getExercise(exerciseId: string) {
  return apiFetch<Exercise>(`/exercises/${exerciseId}`);
}

export function createExercise(body: CreateExerciseBody) {
  return apiFetch<Exercise>("/exercises", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateExercise(exerciseId: string, body: UpdateExerciseBody) {
  return apiFetch<Exercise>(`/exercises/${exerciseId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
