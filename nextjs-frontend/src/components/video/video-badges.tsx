import { Clock, TriangleAlert, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AI_REVIEW_TERMS, formatReviewCounts } from "@/lib/domain/ai-review";

/** Coach review state of a completed analysis (label + icon + tone, never colour alone). */
export function CoachReviewStateBadge({
    reviewed,
    lowConfidenceCount = 0,
    size,
    className,
}: {
    reviewed: boolean;
    /** Unreviewed low-confidence detections; shown instead of "Awaiting" when present. */
    lowConfidenceCount?: number;
    size?: "sm" | "md";
    className?: string;
}) {
    if (reviewed) {
        return (
            <Badge tone="success" icon={UserCheck} size={size} className={className}>
                Coach reviewed
            </Badge>
        );
    }
    const [lowConfidence] = formatReviewCounts({ lowConfidenceDetections: lowConfidenceCount });
    if (lowConfidence) {
        return (
            <Badge tone="warning" icon={TriangleAlert} size={size} className={className}>
                {AI_REVIEW_TERMS.needsReview} · {lowConfidence}
            </Badge>
        );
    }
    return (
        <Badge tone="neutral" icon={Clock} size={size} className={className}>
            Awaiting coach review
        </Badge>
    );
}
