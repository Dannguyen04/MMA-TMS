import { Sparkles, Upload, Video } from "lucide-react";
import Link from "next/link";

import { AINotice } from "@/components/domain/ai-notice";
import { AIGeneratedBadge, ConfidenceBadge, ReviewStateBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { CoachReviewStateBadge } from "@/components/video/video-badges";
import { reviewCounts } from "@/lib/domain/ai-review";
import { techniqueLabel, trainingTypeLabel } from "@/lib/domain/labels";
import type { AIAnalysis, FindingCategory, Video as VideoRecord } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

const FINDINGS_SHOWN = 3;

function findingCategoryLabel(t: Translator, category: FindingCategory): string {
    return category === "movement_quality" ? t("screens.roster.analysis.movementQuality") : techniqueLabel(t, category);
}

export interface AnalysisSummaryCardProps {
    video: VideoRecord | null;
    analysis: AIAnalysis | null;
    videoHref: string | null;
    libraryHref: string;
    uploadHref: string;
    /** Server time (ISO). */
    now: string;
    className?: string;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}

/** The latest completed AI analysis for a fighter: summary, confidence, review state and the findings to check first. */
export function AnalysisSummaryCard({ video, analysis, videoHref, libraryHref, uploadHref, now, className, locale = "en" }: AnalysisSummaryCardProps) {
    const t = createTranslator(locale);
    const findings = analysis
        ? [...analysis.findings].sort((a, b) => Number(a.review !== null) - Number(b.review !== null) || a.confidence - b.confidence).slice(0, FINDINGS_SHOWN)
        : [];
    const counts = analysis ? reviewCounts(analysis) : null;
    const toReview = counts
        ? ([
              [counts.unreviewedFindings, "screens.roster.analysis.unreviewed"],
              [counts.lowConfidenceFindings, "screens.roster.analysis.lowConfidenceFindings"],
              [counts.lowConfidenceDetections, "review.lowConfidence"],
          ] as const).flatMap(([count, key]) => (count ? [plural(t, key, count)] : []))
        : [];

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title={t("screens.roster.analysis.title")} icon={<Sparkles />} action={<CardLink href={libraryHref}>{t("screens.roster.analysis.allVideos")}</CardLink>} />
            <CardContent className="flex flex-col gap-4">
                {!video || !analysis ? (
                    <EmptyState
                        compact
                        icon={<Video />}
                        title={t("screens.roster.analysis.emptyTitle")}
                        description={t("screens.roster.analysis.emptyDesc")}
                        action={
                            <ButtonLink href={uploadHref} variant="secondary" size="sm">
                                <Upload aria-hidden />
                                {t("screens.roster.overview.uploadVideo")}
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
                                    {trainingTypeLabel(t, video.trainingType)} · {t("screens.roster.analysis.analysed")}{" "}
                                    <time dateTime={analysis.processedAt} title={formatDateTime(analysis.processedAt, locale)}>
                                        {formatRelative(analysis.processedAt, now, locale)}
                                    </time>{" "}
                                    · {plural(t, "screens.roster.analysis.findings", analysis.findings.length)}
                                </p>
                                <p className="mt-0.5 text-[13px] text-fg-muted">
                                    {toReview.length > 0 ? t("screens.roster.analysis.toReview", { items: toReview.join(" · ") }) : t("screens.roster.analysis.nothingToReview")}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <AIGeneratedBadge size="sm" locale={locale} />
                                    <ConfidenceBadge confidence={analysis.overallConfidence} size="sm" locale={locale} />
                                    <CoachReviewStateBadge reviewed={analysis.coachReview !== null} lowConfidenceCount={counts?.lowConfidenceDetections} size="sm" locale={locale} />
                                </div>
                            </div>
                        </div>

                        <p className="rounded-lg bg-surface-muted px-3.5 py-2.5 text-sm text-pretty text-fg">
                            <span className="sr-only">{t("screens.roster.analysis.summarySr")}</span>
                            {analysis.summary}
                        </p>

                        {findings.length > 0 && (
                            <div>
                                <h3 className="mb-2 text-[13px] font-semibold text-fg">{t("screens.roster.analysis.checkFirst")}</h3>
                                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                                    {findings.map((finding) => (
                                        <li key={finding.id} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                            <p className="min-w-0 text-sm">
                                                <span className="block text-xs text-fg-muted">{findingCategoryLabel(t, finding.category)}</span>
                                                <span className="font-medium text-fg">{finding.title}</span>
                                            </p>
                                            <span className="flex shrink-0 flex-wrap gap-1.5">
                                                <ConfidenceBadge confidence={finding.confidence} size="sm" locale={locale} />
                                                <ReviewStateBadge review={finding.review} confidence={finding.confidence} size="sm" locale={locale} />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <AINotice audience="coach" compact locale={locale} />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
