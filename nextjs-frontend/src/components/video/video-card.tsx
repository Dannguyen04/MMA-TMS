import { CircleX, Sparkles } from "lucide-react";
import Link from "next/link";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { VideoStatusBadge } from "@/components/domain/status-badges";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDate, formatRelative, pluralize } from "@/lib/format";
import type { VideoLibraryItem } from "@/lib/services/videos";
import { cn } from "@/lib/utils";
import { LiveJobStatus } from "./live-job-status";
import { CoachReviewStateBadge } from "./video-badges";
import { VideoThumb } from "./video-thumb";

export interface VideoCardProps {
    item: VideoLibraryItem;
    href: string;
    now: string;
    /** Staff libraries show whose footage it is. */
    showFighter: boolean;
    headingLevel?: 2 | 3;
    className?: string;
}

/** Library tile: placeholder thumbnail, status, findings and review state. The whole card links to the analysis. */
export function VideoCard({ item, href, now, showFighter, headingLevel = 3, className }: VideoCardProps) {
    const { video, fighter, job, analysis } = item;
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const processing = video.status === "queued" || video.status === "processing" || video.status === "uploading";

    return (
        <article
            className={cn(
                "group relative flex min-w-0 flex-row overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-colors hover:border-border-strong sm:flex-col",
                className,
            )}
        >
            <VideoThumb trainingType={video.trainingType} status={video.status} durationSec={video.durationSec} className="w-28 shrink-0 self-start max-sm:m-3 max-sm:rounded-lg sm:w-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-3 pr-3 sm:p-4">
                <div className="min-w-0">
                    <Heading className="text-[15px] leading-snug font-semibold text-fg">
                        <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline">
                            {video.title}
                        </Link>
                    </Heading>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                        {TRAINING_TYPE_LABELS[video.trainingType]} ·{" "}
                        <time dateTime={video.uploadedAt} title={formatDate(video.uploadedAt)}>
                            {formatRelative(video.uploadedAt, now)}
                        </time>
                    </p>
                </div>
                <VideoStatusBadge status={video.status} size="sm" className="w-fit sm:hidden" />
                {showFighter && <FighterIdentity fighter={fighter} size="sm" showMeta={false} />}
                <div className="mt-auto flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                    {video.status === "completed" && analysis && (
                        <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-fg">
                                <Sparkles aria-hidden className="size-3.5 text-ai-fg" />
                                {pluralize(analysis.findings, "finding")}
                            </span>
                            <CoachReviewStateBadge reviewed={analysis.coachReviewed} lowConfidenceCount={analysis.lowConfidenceDetections} size="sm" />
                        </>
                    )}
                    {processing && video.jobId && <LiveJobStatus jobId={video.jobId} initialJob={job} />}
                    {video.status === "failed" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-fg">
                            <CircleX aria-hidden className="size-3.5" />
                            Analysis didn&apos;t finish — open for next steps
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
