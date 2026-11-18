import { Clock, TriangleAlert, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";

/** Coach review state of a completed analysis (label + icon + tone, never colour alone). */
export function CoachReviewStateBadge({
    reviewed,
    lowConfidenceCount = 0,
    size,
    className,
    locale = "en",
}: {
    reviewed: boolean;
    /** Unreviewed low-confidence detections; shown instead of "Awaiting" when present. */
    lowConfidenceCount?: number;
    size?: "sm" | "md";
    className?: string;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}) {
    const t = createTranslator(locale);
    if (reviewed) {
        return (
            <Badge tone="success" icon={UserCheck} size={size} className={className}>
                {t("review.coachReviewed")}
            </Badge>
        );
    }
    if (lowConfidenceCount > 0) {
        return (
            <Badge tone="warning" icon={TriangleAlert} size={size} className={className}>
                {t("review.needsReview")} · {plural(t, "review.lowConfidence", lowConfidenceCount)}
            </Badge>
        );
    }
    return (
        <Badge tone="neutral" icon={Clock} size={size} className={className}>
            {t("review.awaiting")}
        </Badge>
    );
}
