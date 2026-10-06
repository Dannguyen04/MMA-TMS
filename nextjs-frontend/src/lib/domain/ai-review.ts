import { pluralize } from "@/lib/format";
import { isLowConfidence } from "./rules";
import type { AIAnalysis, AIFeedback, CoachReview, ReviewDecision, User } from "./types";

/**
 * One vocabulary for the human review of AI output, so queues, cards, KPIs and filters count the
 * same things:
 * - unreviewed: no coach decision yet, whatever the confidence;
 * - needs review: unreviewed and below LOW_CONFIDENCE_THRESHOLD — check these first;
 * - low confidence: the filter and count label for those needs-review items.
 */
export const AI_REVIEW_TERMS = {
    unreviewed: "Unreviewed",
    needsReview: "Needs review",
    lowConfidence: "Low confidence",
} as const;

/** Unreviewed and below the low-confidence threshold. */
export function isNeedsReview(item: { confidence: number | null; review: unknown }): boolean {
    return item.review === null && isLowConfidence(item.confidence);
}

export interface ReviewCounts {
    /** Findings without a human decision. */
    unreviewedFindings: number;
    /** Unreviewed findings below the low-confidence threshold. */
    lowConfidenceFindings: number;
    /** Unreviewed detections below the low-confidence threshold. */
    lowConfidenceDetections: number;
}

export function reviewCounts(analysis: Pick<AIAnalysis, "findings" | "detections">): ReviewCounts {
    return {
        unreviewedFindings: analysis.findings.filter((finding) => finding.review === null).length,
        lowConfidenceFindings: analysis.findings.filter(isNeedsReview).length,
        lowConfidenceDetections: analysis.detections.filter(isNeedsReview).length,
    };
}

/** Non-zero counts as unit-named parts, e.g. ["7 unreviewed findings", "5 low-confidence detections"]. Findings and detections are never summed. */
export function formatReviewCounts(counts: Partial<ReviewCounts>): string[] {
    const parts: [number | undefined, string][] = [
        [counts.unreviewedFindings, "unreviewed finding"],
        [counts.lowConfidenceFindings, "low-confidence finding"],
        [counts.lowConfidenceDetections, "low-confidence detection"],
    ];
    return parts.flatMap(([count, unit]) => (count ? [pluralize(count, unit)] : []));
}

/* ─── Recording a review ──────────────────────────────────────────────────── */

/** A coach's confirm / correct / reject decision on one AI output. */
export interface AIReviewInput {
    decision: ReviewDecision;
    note: string | null;
    /** Required when the decision is "corrected". */
    correctedLabel: string | null;
}

/** A coach's overall review of an analysis. */
export interface CoachReviewInput {
    /** Overall rating of the footage, 1–5. */
    rating: number;
    summary: string;
}

type Refusal<Code extends string> = { ok: false; code: Code; message: string };
type Reviewer = Pick<User, "id" | "name">;

/** The decision as it's kept, for demo and pipeline analyses alike; a correction needs the right label. */
export function reviewFeedback(input: AIReviewInput, reviewer: Reviewer, reviewedAt: string): AIFeedback | Refusal<"correction_label_required"> {
    const correctedLabel = input.correctedLabel?.trim() || null;
    if (input.decision === "corrected" && !correctedLabel) {
        return { ok: false, code: "correction_label_required", message: "Enter the correct label for this AI output." };
    }
    return {
        decision: input.decision,
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        reviewedAt,
        note: input.note?.trim() || null,
        correctedLabel: input.decision === "corrected" ? correctedLabel : null,
    };
}

/** The overall review as it's kept, for demo and pipeline analyses alike: a 1–5 rating and a summary. */
export function coachReviewFrom(input: CoachReviewInput, reviewer: Reviewer, reviewedAt: string): CoachReview | Refusal<"invalid_rating" | "summary_required"> {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        return { ok: false, code: "invalid_rating", message: "Rate the footage from 1 to 5." };
    }
    const summary = input.summary.trim();
    if (!summary) return { ok: false, code: "summary_required", message: "Add a short summary for the fighter." };
    return { reviewerId: reviewer.id, reviewerName: reviewer.name, reviewedAt, rating: input.rating, summary };
}
