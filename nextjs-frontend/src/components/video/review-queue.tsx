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
export function ReviewQueue({ items, now }: { items: ReviewQueueItem[]; now: string }) {
    return (
        <Card>
            <CardHeader
                icon={<Sparkles />}
                title="Review queue"
                description="Completed AI analyses waiting for your review. Confirm or correct findings before fighters rely on them."
                action={
                    items.length > 0 && (
                        <Badge tone="warning" size="md" className="max-sm:hidden">
                            {pluralize(items.length, "analysis", "analyses")} to review
                        </Badge>
                    )
                }
            />
            {items.length === 0 ? (
                <div className="px-5 pb-5">
                    <EmptyState compact icon={<CircleCheck />} title="You're all caught up" description="New analyses from your fighters appear here as soon as the AI finishes processing." />
                </div>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {items.map(({ analysis, video, fighter, unreviewedFindings, lowConfidenceFindings, lowConfidenceDetections }) => {
                        const [unreviewed] = formatReviewCounts({ unreviewedFindings });
                        // Findings and detections are different units, so each keeps its own count.
                        const lowConfidence = formatReviewCounts({ lowConfidenceFindings, lowConfidenceDetections });
                        return (
                            <li key={analysis.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-4">
                                <VideoThumb trainingType={video.trainingType} durationSec={video.durationSec} size="sm" className="hidden w-28 shrink-0 rounded-lg md:block" />
                                <div className="min-w-0 flex-1">
                                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} />
                                    <p className="mt-1.5 truncate text-sm font-medium text-fg">{video.title}</p>
                                    <p className="text-xs text-fg-muted">
                                        {TRAINING_TYPE_LABELS[video.trainingType]} · analysed{" "}
                                        <time dateTime={analysis.processedAt} title={formatDateTime(analysis.processedAt)}>
                                            {formatRelative(analysis.processedAt, now)}
                                        </time>
                                    </p>
                                </div>
                                <ul aria-label="Still to review" className="flex flex-wrap items-center gap-2 md:max-w-md md:justify-end">
                                    <li>
                                        {unreviewed ? (
                                            <Badge tone="ai" icon={Sparkles} size="sm">
                                                {unreviewed}
                                            </Badge>
                                        ) : (
                                            <Badge tone="neutral" icon={CircleCheck} size="sm">
                                                All findings reviewed
                                            </Badge>
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
                                                No low-confidence items
                                            </Badge>
                                        </li>
                                    )}
                                </ul>
                                <ButtonLink href={routes.coach.video(video.id)} variant="secondary" size="sm" aria-label={`Review ${video.title}`} className="self-start md:self-center">
                                    Review
                                    <ArrowRight aria-hidden />
                                </ButtonLink>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
