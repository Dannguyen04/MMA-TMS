import { apiFetch } from "./client";
import { parseWorkerResult, type WorkerResult } from "@/components/video/pose-model";

/**
 * Video evidence endpoints (nestjs-api):
 * - GET  /jobs/:id/result                      FIGHTER, COACH, DOCTOR, ADMIN · scoped by coach_fighters / doctor_fighters · 409 JOB_NOT_COMPLETE
 * - GET  /coaching/jobs/:jobId/state           FIGHTER, COACH, ADMIN (no DOCTOR)
 * - POST /coaching/findings/review             COACH only (assigned)
 * - POST /coaching/corrections                 COACH only (assigned)
 * - GET  /movement-evidence/jobs/:jobId/reviews  movement.evidence:read
 * - POST /movement-evidence/jobs/:jobId/reviews  movement.evidence:review (COACH, DOCTOR)
 */

const resultCache = new Map<string, WorkerResult>();

export class ResultShapeError extends Error {
  constructor() {
    super("RESULT_SHAPE");
  }
}

/** Fetched on demand and kept for the session: the JSON can be several MB. */
export async function getJobResult(jobId: string, options: { fresh?: boolean } = {}): Promise<WorkerResult> {
  const cached = resultCache.get(jobId);
  if (cached && !options.fresh) return cached;
  const raw = await apiFetch<unknown>(`/jobs/${encodeURIComponent(jobId)}/result`);
  const parsed = parseWorkerResult(raw);
  if (!parsed) throw new ResultShapeError();
  resultCache.set(jobId, parsed);
  return parsed;
}

export function clearResultCache() {
  resultCache.clear();
}

export type FindingReviewStatus = "approved" | "rejected" | "corrected";

export type CoachingState = {
  jobId: string;
  videoId: string;
  fighterId: string;
  analysisId: string | null;
  reviews: {
    actionId: string;
    findingId: string;
    coachId: string;
    status: FindingReviewStatus;
    notes: string | null;
    correctedLabel: string | null;
    createdAt: string;
  }[];
  corrections: { coachId: string; reviewText: string; techniqueRating: number | null; createdAt: string }[];
};

export function getCoachingState(jobId: string) {
  return apiFetch<CoachingState>(`/coaching/jobs/${encodeURIComponent(jobId)}/state`);
}

export function reviewFinding(input: {
  analysisId: string;
  actionId: string;
  findingId: string;
  status: FindingReviewStatus;
  notes?: string;
  correctedLabel?: string;
}) {
  return apiFetch<{ id: string }>("/coaching/findings/review", { method: "POST", body: JSON.stringify(input) });
}

export function submitCoachCorrection(input: { analysisId: string; reviewText: string; techniqueRating: number }) {
  return apiFetch<{ id: string }>("/coaching/corrections", { method: "POST", body: JSON.stringify(input) });
}

export type MovementDecision = "confirmed" | "corrected" | "rejected";

export type MovementReviewState = {
  jobId: string;
  reviewerId: string;
  canReview: boolean;
  context: { exerciseName: string | null; sessionExerciseId: string | null } | null;
  reviews: {
    id: string;
    windowId: string;
    reviewerId: string;
    reviewerRole: "COACH" | "DOCTOR";
    revision: number;
    decision: MovementDecision;
    notes: string;
    startMs: number | null;
    endMs: number | null;
    createdAt: string;
  }[];
};

export function getMovementReviews(jobId: string) {
  return apiFetch<MovementReviewState>(`/movement-evidence/jobs/${encodeURIComponent(jobId)}/reviews`);
}

export function appendMovementReview(
  jobId: string,
  input: {
    requestId: string;
    windowId: string;
    expectedRevision: number;
    decision: MovementDecision;
    notes: string;
    startMs?: number;
    endMs?: number;
  },
) {
  return apiFetch<{ id: string; revision: number; replayed: boolean }>(
    `/movement-evidence/jobs/${encodeURIComponent(jobId)}/reviews`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
