"use client";

import { MessageSquareText } from "lucide-react";
import { useState } from "react";

import { CoachRating, CoachRatingInput } from "@/components/domain/coach-rating";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitCoachReviewAction } from "@/lib/actions/video";
import type { AIFinding, CoachReview } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";

export interface CoachReviewPanelProps {
    analysisId: string;
    review: CoachReview | null;
    findings: AIFinding[];
    canReview: boolean;
    now: string;
}

/** Overall coach verdict on the footage. Coaches write it; fighters read it. */
export function CoachReviewPanel({ analysisId, review, findings, canReview, now }: CoachReviewPanelProps) {
    const reviewed = findings.filter((f) => f.review !== null).length;

    if (!canReview) {
        return (
            <div className="pt-3">
                {review ? (
                    <ReviewSummary review={review} now={now} heading="Coach review" />
                ) : (
                    <EmptyState
                        compact
                        icon={<MessageSquareText />}
                        title="Awaiting coach review"
                        description="Your coach hasn't reviewed this analysis yet. You'll get a notification when they do — until then, treat AI findings as a guide."
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pt-3">
            {review && <ReviewSummary review={review} now={now} heading="Current review" />}
            <CoachReviewForm analysisId={analysisId} review={review} reviewedFindings={reviewed} totalFindings={findings.length} />
        </div>
    );
}

function ReviewSummary({ review, now, heading }: { review: CoachReview; now: string; heading: string }) {
    return (
        <section aria-label={heading} className="rounded-lg border border-border bg-surface-muted px-3.5 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{heading}</h3>
            <CoachRating rating={review.rating} className="mt-2" />
            <p className="mt-2 text-sm text-pretty text-fg">“{review.summary}”</p>
            <p className="mt-2 text-xs text-fg-muted">
                {review.reviewerName} ·{" "}
                <time dateTime={review.reviewedAt} title={formatDateTime(review.reviewedAt)}>
                    {formatRelative(review.reviewedAt, now)}
                </time>
            </p>
        </section>
    );
}

function CoachReviewForm({
    analysisId,
    review,
    reviewedFindings,
    totalFindings,
}: {
    analysisId: string;
    review: CoachReview | null;
    reviewedFindings: number;
    totalFindings: number;
}) {
    const toast = useToast();
    const form = useActionForm(submitCoachReviewAction, {
        onSuccess: () => toast({ title: "Coach review saved", description: "The fighter has been notified." }),
    });
    const [rating, setRating] = useState(review?.rating ?? 0);
    const summaryHint = "What went well, what to fix next session. The fighter sees this.";
    const summary = form.control("summary", { hint: summaryHint, required: true });

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="analysisId" value={analysisId} />
            <p className="text-[13px] text-fg-muted">
                {reviewedFindings} of {totalFindings} findings reviewed.{" "}
                {reviewedFindings < totalFindings ? "Review the findings first so your summary matches what the fighter sees." : "All findings reviewed."}
            </p>

            <CoachRatingInput
                id={form.control("rating").id}
                name="rating"
                legend="Overall rating"
                value={rating}
                onChange={setRating}
                error={form.error("rating")}
                required
            />

            <Field label="Summary for the fighter" htmlFor={summary.id} required hint={summaryHint} error={form.error("summary")}>
                <Textarea {...summary} rows={4} maxLength={1500} defaultValue={review?.summary ?? ""} />
            </Field>

            <FormMessage {...form.message} />
            <SubmitButton pending={form.pending} pendingLabel="Saving review…" className="self-start">
                {review ? "Update coach review" : "Save coach review"}
            </SubmitButton>
        </form>
    );
}
