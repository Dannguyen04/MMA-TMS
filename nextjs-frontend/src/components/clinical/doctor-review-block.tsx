import { UserCheck } from "lucide-react";

import { StatusBadge } from "@/components/domain/status-badges";
import type { DoctorReview } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DOCTOR_DECISION_META } from "./clinical-badges";

/** The clinician's decision on an AI observation — styled as a human record, never as AI output. */
export function DoctorReviewBlock({ review, compact = false, className }: { review: DoctorReview; compact?: boolean; className?: string }) {
    return (
        <div className={cn("rounded-lg border border-border bg-surface-muted/60", compact ? "px-3 py-2.5" : "px-4 py-3", className)}>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                <UserCheck aria-hidden className="size-4 text-fg-muted" />
                Doctor&apos;s decision
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadge meta={DOCTOR_DECISION_META[review.decision]} size="sm" />
                <span className="text-[13px] text-fg-muted">
                    {review.reviewerName} · <time dateTime={review.reviewedAt}>{formatDateTime(review.reviewedAt)}</time>
                </span>
            </div>
            <p className={cn("mt-2 text-pretty text-fg", compact ? "line-clamp-3 text-[13px]" : "text-sm")}>{review.note}</p>
        </div>
    );
}
