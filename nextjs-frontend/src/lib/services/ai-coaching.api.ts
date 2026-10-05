import "server-only";
import { z } from "zod";
import { pipelineApiRequest } from "@/lib/api/pipeline-auth";
import type { AIAnalysis, AIFeedback } from "@/lib/domain/types";

const evidenceReviewSchema = z.object({
    actionId: z.string(), findingId: z.string(), coachId: z.string(),
    status: z.enum(["approved", "rejected", "corrected"]), notes: z.string().nullable(),
    correctedLabel: z.string().nullable(), createdAt: z.string(),
});
const correctionSchema = z.object({
    coachId: z.string(), reviewText: z.string(), techniqueRating: z.number().nullable(), createdAt: z.string(),
});
export const reviewStateSchema = z.object({
    jobId: z.string().uuid(), videoId: z.string().uuid(), fighterId: z.string().uuid(), analysisId: z.string().uuid().nullable(),
    reviews: z.array(evidenceReviewSchema), corrections: z.array(correctionSchema),
});
export const readReviewState = (jobId: string) => pipelineApiRequest(`/coaching/jobs/${encodeURIComponent(jobId)}/state`, reviewStateSchema);

export function applyPersistedReviews(analysis: AIAnalysis, state: z.infer<typeof reviewStateSchema>): AIAnalysis {
    // The API returns newest first. AI findings and labels remain unchanged;
    // human feedback is an independently persisted layer.
    const feedback = (actionId: string | undefined, findingId: string | undefined): AIFeedback | null => {
        const r = state.reviews.find((r) => r.actionId === actionId && r.findingId === findingId);
        return r ? { decision: r.status === "approved" ? "confirmed" : r.status, reviewerId: r.coachId,
            reviewerName: "Coach", reviewedAt: r.createdAt, note: r.notes, correctedLabel: r.correctedLabel } : null;
    };
    for (const detection of analysis.detections) detection.review = feedback(detection.workerActionId, "@action");
    for (const finding of analysis.findings) finding.review = feedback(finding.workerActionId, finding.workerFindingId);
    const last = state.corrections[0];
    if (last) analysis.coachReview = { reviewerId: last.coachId, reviewerName: "Coach", reviewedAt: last.createdAt,
        rating: last.techniqueRating ?? 0, summary: last.reviewText };
    return analysis;
}

export async function persistEvidenceReview(jobId: string, actionId: string, findingId: string,
    input: { decision: string; note: string | null; correctedLabel: string | null }) {
    const state = await readReviewState(jobId);
    if (!state.analysisId) throw new Error("Structured results have not been persisted for this job. Reprocess the video before reviewing.");
    await pipelineApiRequest("/coaching/findings/review", z.object({ id: z.string().uuid() }).passthrough(), {
        method: "POST", body: JSON.stringify({ analysisId: state.analysisId, actionId, findingId,
            status: input.decision === "confirmed" ? "approved" : input.decision,
            notes: input.note ?? undefined, correctedLabel: input.correctedLabel ?? undefined }),
    });
}

export async function persistCoachSummary(jobId: string, input: { rating: number; summary: string }) {
    const state = await readReviewState(jobId);
    if (!state.analysisId) throw new Error("Structured results have not been persisted for this job.");
    await pipelineApiRequest("/coaching/corrections", z.object({ id: z.string().uuid() }).passthrough(), {
        method: "POST", body: JSON.stringify({ analysisId: state.analysisId, reviewText: input.summary, techniqueRating: input.rating }),
    });
}
