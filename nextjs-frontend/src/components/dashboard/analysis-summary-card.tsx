import { Sparkles, Upload, Video } from "lucide-react";
import Link from "next/link";

import { AINotice } from "@/components/domain/ai-notice";
import { AIGeneratedBadge, ConfidenceBadge, ReviewStateBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { CoachReviewStateBadge } from "@/components/video/video-badges";
import { formatReviewCounts, reviewCounts } from "@/lib/domain/ai-review";
import { FINDING_CATEGORY_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { AIAnalysis, Video as VideoRecord } from "@/lib/domain/types";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

const FINDINGS_SHOWN = 3;

export interface AnalysisSummaryCardProps {
    video: VideoRecord | null;
    analysis: AIAnalysis | null;
    videoHref: string | null;
    libraryHref: string;
    uploadHref: string;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/** The latest completed AI analysis for a fighter: summary, confidence, review state and the findings to check first. */
export function AnalysisSummaryCard({ video, analysis, videoHref, libraryHref, uploadHref, now, className }: AnalysisSummaryCardProps) {
    const findings = analysis
        ? [...analysis.findings].sort((a, b) => Number(a.review !== null) - Number(b.review !== null) || a.confidence - b.confidence).slice(0, FINDINGS_SHOWN)
        : [];
    const counts = analysis ? reviewCounts(analysis) : null;
    const toReview = counts ? formatReviewCounts(counts) : [];

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Latest AI analysis" icon={<Sparkles />} action={<CardLink href={libraryHref}>All videos</CardLink>} />
            <CardContent className="flex flex-col gap-4">
                {!video || !analysis ? (
                    <EmptyState
                        compact
                        icon={<Video />}
                        title="No analysed footage yet"
                        description="Upload a training clip to get AI technique findings you can confirm or correct."
                        action={
                            <ButtonLink href={uploadHref} variant="secondary" size="sm">
                                <Upload aria-hidden />
                                Upload video
                            </ButtonLink>
                        }
                        className="pt-0"
                    />
                ) : (
                    <>
                        <div className="flex items-start gap-3">
                            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-border ring-inset">
                                <TrainingTypeIcon type={video.trainingType} className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[15px] leading-snug font-semibold text-fg">
                                    {videoHref ? (
                                        <Link href={videoHref} className="rounded-sm hover:underline">
                                            {video.title}
                                        </Link>
                                    ) : (
                                        video.title
                                    )}
                                </p>
                                <p className="mt-0.5 text-[13px] text-fg-muted">
                                    {TRAINING_TYPE_LABELS[video.trainingType]} · analysed{" "}
                                    <time dateTime={analysis.processedAt} title={formatDateTime(analysis.processedAt)}>
                                        {formatRelative(analysis.processedAt, now)}
                                    </time>{" "}
                                    · {pluralize(analysis.findings.length, "finding")}
                                </p>
                                <p className="mt-0.5 text-[13px] text-fg-muted">{toReview.length > 0 ? `To review: ${toReview.join(" · ")}` : "Nothing left to review"}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <AIGeneratedBadge size="sm" />
                                    <ConfidenceBadge confidence={analysis.overallConfidence} size="sm" />
                                    <CoachReviewStateBadge reviewed={analysis.coachReview !== null} lowConfidenceCount={counts?.lowConfidenceDetections} size="sm" />
                                </div>
                            </div>
                        </div>

                        <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-sm text-pretty text-fg">
                            <span className="sr-only">AI-generated summary: </span>
                            {analysis.summary}
                        </p>

                        {findings.length > 0 && (
                            <div>
                                <h3 className="mb-2 text-[13px] font-semibold text-fg">Findings to check first</h3>
                                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                                    {findings.map((finding) => (
                                        <li key={finding.id} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                            <p className="min-w-0 text-sm">
                                                <span className="block text-xs text-fg-muted">{FINDING_CATEGORY_LABELS[finding.category]}</span>
                                                <span className="font-medium text-fg">{finding.title}</span>
                                            </p>
                                            <span className="flex shrink-0 flex-wrap gap-1.5">
                                                <ConfidenceBadge confidence={finding.confidence} size="sm" />
                                                <ReviewStateBadge review={finding.review} confidence={finding.confidence} size="sm" />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <AINotice audience="coach" compact />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
