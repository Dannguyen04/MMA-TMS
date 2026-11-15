"use client";

import { MessageSquareText } from "lucide-react";
import { useState } from "react";

import { CoachRating, CoachRatingInput } from "@/components/domain/coach-rating";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitCoachReviewAction } from "@/lib/actions/video";
import type { AIFinding, CoachReview } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

export interface CoachReviewPanelProps {
    analysisId: string;
    review: CoachReview | null;
    findings: AIFinding[];
    canReview: boolean;
    now: string;
}

/** Overall coach verdict on the footage. Coaches write it; fighters read it. */
export function CoachReviewPanel({ analysisId, review, findings, canReview, now }: CoachReviewPanelProps) {
    const t = useT();
    const locale = useLocale();
    const reviewed = findings.filter((f) => f.review !== null).length;

    if (!canReview) {
        return (
            <div className="pt-3">
                {review ? (
                    <ReviewSummary review={review} now={now} heading={t("screens.video.workspace.coachReview")} locale={locale} />
                ) : (
                    <EmptyState
                        compact
                        icon={<MessageSquareText />}
                        title={t("screens.video.coachReview.awaiting")}
                        description={t("screens.video.coachReview.awaitingDesc")}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pt-3">
            {review && <ReviewSummary review={review} now={now} heading={t("screens.video.coachReview.current")} locale={locale} />}
            <CoachReviewForm analysisId={analysisId} review={review} reviewedFindings={reviewed} totalFindings={findings.length} />
        </div>
    );
}

function ReviewSummary({ review, now, heading, locale }: { review: CoachReview; now: string; heading: string; locale: Locale }) {
    return (
        <section aria-label={heading} className="rounded-lg border border-border bg-surface-muted px-3.5 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{heading}</h3>
            <CoachRating rating={review.rating} className="mt-2" locale={locale} />
            <p className="mt-2 text-sm text-pretty text-fg">“{review.summary}”</p>
            <p className="mt-2 text-xs text-fg-muted">
                {review.reviewerName} ·{" "}
                <time dateTime={review.reviewedAt} title={formatDateTime(review.reviewedAt, locale)}>
                    {formatRelative(review.reviewedAt, now, locale)}
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
    const t = useT();
    const locale = useLocale();
    const form = useActionForm(submitCoachReviewAction, {
        onSuccess: () => toast({ title: t("screens.video.coachReview.saved"), description: t("screens.video.coachReview.notified") }),
    });
    const [rating, setRating] = useState(review?.rating ?? 0);
    const summaryHint = t("screens.video.coachReview.summaryHint");
    const summary = form.control("summary", { hint: summaryHint, required: true });

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="analysisId" value={analysisId} />
            <p className="text-[13px] text-fg-muted">
                {t("screens.video.coachReview.progress", { reviewed: reviewedFindings, total: totalFindings })}{" "}
                {reviewedFindings < totalFindings ? t("screens.video.coachReview.reviewFirst") : t("screens.video.coachReview.allReviewed")}
            </p>

            <CoachRatingInput
                id={form.control("rating").id}
                name="rating"
                legend={t("screens.video.coachReview.rating")}
                value={rating}
                onChange={setRating}
                error={form.error("rating")}
                required
                locale={locale}
            />

            <Field label={t("screens.video.coachReview.summary")} htmlFor={summary.id} required hint={summaryHint} error={form.error("summary")}>
                <Textarea {...summary} rows={4} maxLength={1500} defaultValue={review?.summary ?? ""} />
            </Field>

            <FormMessage {...form.message} />
            <SubmitButton pending={form.pending} pendingLabel={t("screens.video.coachReview.saving")} className="self-start">
                {review ? t("screens.video.coachReview.update") : t("screens.video.coachReview.save")}
            </SubmitButton>
        </form>
    );
}
