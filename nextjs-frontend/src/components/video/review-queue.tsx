import { getDemoCopy, getLocale } from "@/lib/i18n/server";
import { ArrowRight, CircleCheck, Sparkles, TriangleAlert } from "lucide-react";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatReviewCounts } from "@/lib/domain/ai-review";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { ReviewQueueItem } from "@/lib/services/videos";
import { VideoThumb } from "./video-thumb";

/** Completed analyses awaiting the coach's review, with what needs attention in each. */
export async function ReviewQueue({ items, now }: { items: ReviewQueueItem[]; now: string }) {
    const copy = await getDemoCopy();
    const locale = await getLocale();
    return (
        <Card>
            <CardHeader
                icon={<Sparkles />}
                title={copy("Review queue")}
                description={copy("Completed AI analyses waiting for your review. Confirm or correct findings before fighters rely on them.")}
                action={
                    items.length > 0 && (
                        <Badge tone="warning" size="md" className="max-sm:hidden">
                            {locale === "vi" ? copy("{n} analyses to review", { n: items.length }) : `${pluralize(items.length, "analysis", "analyses")} to review`}
                        </Badge>
                    )
                }
            />
            {items.length === 0 ? (
                <div className="px-5 pb-5">
                    <EmptyState compact icon={<CircleCheck />} title={copy("You're all caught up")} description={copy("New analyses from your fighters appear here as soon as the AI finishes processing.")} />
                </div>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {items.map(({ analysis, video, fighter, unreviewedFindings, lowConfidenceFindings, lowConfidenceDetections }) => {
                        const unreviewed = locale === "vi" ? (unreviewedFindings > 0 ? copy("{n} findings awaiting review", { n: unreviewedFindings }) : null) : formatReviewCounts({ unreviewedFindings })[0];
                        // Findings and detections are different units, so each keeps its own count.
                        const lowConfidence = locale === "vi" ? [...(lowConfidenceFindings > 0 ? [copy("{n} low-confidence findings", { n: lowConfidenceFindings })] : []), ...(lowConfidenceDetections > 0 ? [copy("{n} low-confidence detections", { n: lowConfidenceDetections })] : [])] : formatReviewCounts({ lowConfidenceFindings, lowConfidenceDetections });
                        return (
                            <li key={analysis.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-4">
                                <VideoThumb locale={locale} trainingType={video.trainingType} durationSec={video.durationSec} size="sm" className="hidden w-28 shrink-0 rounded-lg md:block" />
                                <div className="min-w-0 flex-1">
                                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} />
                                    <p className="mt-1.5 truncate text-sm font-medium text-fg">{video.title}</p>
                                    <p className="text-xs text-fg-muted">
                                        {copy(TRAINING_TYPE_LABELS[video.trainingType])} · {copy("analysed")}{" "}
                                        <time dateTime={analysis.processedAt} title={formatDateTime(analysis.processedAt, locale)}>
                                            {formatRelative(analysis.processedAt, now, locale)}
                                        </time>
                                    </p>
                                </div>
                                <ul aria-label={copy("Still to review")} className="flex flex-wrap items-center gap-2 md:max-w-md md:justify-end">
                                    <li>
                                        {unreviewed ? (
                                            <Badge tone="ai" icon={Sparkles} size="sm">
                                                {unreviewed}
                                            </Badge>
                                        ) : (
                                            <Badge tone="neutral" icon={CircleCheck} size="sm">
                                                {copy("All findings reviewed")} </Badge>
                                        )}
                                    </li>
                                    {lowConfidence.length > 0 ? (
                                        lowConfidence.map((part) => (
                                            <li key={part}>
                                                <Badge tone="warning" icon={TriangleAlert} size="sm">
                                                    {part}
                                                </Badge>
                                            </li>
                                        ))
                                    ) : (
                                        <li>
                                            <Badge tone="neutral" icon={CircleCheck} size="sm">
                                                {copy("No low-confidence items")} </Badge>
                                        </li>
                                    )}
                                </ul>
                                <ButtonLink href={routes.coach.video(video.id)} variant="secondary" size="sm" aria-label={copy("Review {title}", { title: video.title })} className="self-start md:self-center">
                                    {copy("Review")} <ArrowRight aria-hidden />
                                </ButtonLink>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
