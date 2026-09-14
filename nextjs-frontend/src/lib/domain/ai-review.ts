import { pluralize } from "@/lib/format";
import { isLowConfidence } from "./rules";
import type { AIAnalysis } from "./types";

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
export function isNeedsReview(item: { confidence: number; review: unknown }): boolean {
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
