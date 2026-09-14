import { CircleX, Sparkles, Upload, Video } from "lucide-react";
import Link from "next/link";

import { AINotice } from "@/components/domain/ai-notice";
import { VideoStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { CoachReviewStateBadge } from "@/components/video/video-badges";
import { PIPELINE_STAGE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import type { VideoLibraryItem } from "@/lib/services/videos";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

/** With fewer uploads than this, the card suggests filming the next session. */
const UPLOAD_PROMPT_BELOW = 3;

export interface LatestAnalysesCardProps {
    items: VideoLibraryItem[];
    videoHref: (videoId: string) => string;
    libraryHref: string;
    uploadHref: string;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/** The fighter's most recent footage with AI status, findings and whether the coach has reviewed it. Server Component. */
export function LatestAnalysesCard({ items, videoHref, libraryHref, uploadHref, now, className }: LatestAnalysesCardProps) {
    return (
        <Card className={cn("flex min-w-0 flex-col", className)}>
            <CardHeader
                title="Latest AI analyses"
                description="Your uploads and what the AI found"
                icon={<Sparkles />}
                action={<CardLink href={libraryHref}>All videos</CardLink>}
            />
            {items.length === 0 ? (
                <CardContent className="flex flex-1 flex-col justify-center">
                    <EmptyState
                        compact
                        icon={<Video />}
                        title="No videos yet"
                        description="Upload a training clip and the AI breaks down your strikes, guard and footwork for you and your coach."
                        action={
                            <ButtonLink href={uploadHref} variant="secondary" size="sm">
                                <Upload aria-hidden />
                                Upload video
                            </ButtonLink>
                        }
                    />
                </CardContent>
            ) : (
                <>
                    <ul className="flex flex-col divide-y divide-border border-t border-border">
                        {items.map((item) => (
                            <AnalysisRow key={item.video.id} item={item} href={videoHref(item.video.id)} now={now} />
                        ))}
                    </ul>
                    {items.length < UPLOAD_PROMPT_BELOW && (
                        <div className="flex flex-1 items-center border-t border-border px-5 py-4">
                            <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span aria-hidden className="octagon flex size-9 shrink-0 items-center justify-center bg-surface-muted text-fg-subtle">
                                        <Video className="size-4" />
                                    </span>
                                    <p className="min-w-0 text-[13px] text-pretty text-fg-muted">
                                        <span className="block text-sm font-medium text-fg">Film your next session</span>
                                        More clips give the AI a clearer picture of your technique trends.
                                    </p>
                                </div>
                                <ButtonLink href={uploadHref} variant="secondary" size="sm">
                                    <Upload aria-hidden />
                                    Upload video
                                </ButtonLink>
                            </div>
                        </div>
                    )}
                    <CardContent className="mt-auto border-t border-border pt-4">
                        <AINotice audience="fighter" compact />
                    </CardContent>
                </>
            )}
        </Card>
    );
}

function AnalysisRow({ item, href, now }: { item: VideoLibraryItem; href: string; now: string }) {
    const { video, job, analysis } = item;
    const inFlight = video.status === "uploading" || video.status === "queued" || video.status === "processing";
    const stage = !job || job.status === "queued" ? PIPELINE_STAGE_LABELS.queued : PIPELINE_STAGE_LABELS[job.stage];

    return (
        <li className="relative flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted/50">
            <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-border ring-inset">
                <TrainingTypeIcon type={video.trainingType} />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="min-w-0 text-sm font-medium text-fg">
                        <Link href={href} className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline">
                            {video.title}
                        </Link>
                    </p>
                    <time dateTime={video.uploadedAt} title={formatDateTime(video.uploadedAt)} className="shrink-0 text-xs text-fg-subtle">
                        {formatRelative(video.uploadedAt, now)}
                    </time>
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">{TRAINING_TYPE_LABELS[video.trainingType]}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <VideoStatusBadge status={video.status} size="sm" />
                    {video.status === "completed" && analysis && (
                        <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-fg">
                                <Sparkles aria-hidden className="size-3.5 text-ai-fg" />
                                {pluralize(analysis.findings, "finding")}
                            </span>
                            <CoachReviewStateBadge reviewed={analysis.coachReviewed} lowConfidenceCount={analysis.lowConfidenceDetections} size="sm" />
                        </>
                    )}
                    {inFlight && <span className="text-xs text-fg-muted">Processing · {stage}</span>}
                    {video.status === "failed" && (
                        <span className="inline-flex items-center gap-1 text-xs text-danger-fg">
                            <CircleX aria-hidden className="size-3.5" />
                            Didn&apos;t finish — open for next steps
                        </span>
                    )}
                </div>
                {inFlight && (
                    <ProgressBar
                        value={job?.progressPct ?? 0}
                        size="sm"
                        hideValue
                        label={`AI analysis progress for ${video.title}`}
                        valueText={`${job?.progressPct ?? 0}%, ${stage}`}
                        className="mt-2 max-w-72"
                    />
                )}
            </div>
        </li>
    );
}
