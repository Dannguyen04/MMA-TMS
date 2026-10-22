import { CircleX, MessageSquareText, Sparkles, Upload } from "lucide-react";
import Link from "next/link";

import { AINotice } from "@/components/domain/ai-notice";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { VideoStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { CoachReviewStateBadge } from "@/components/video/video-badges";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import type { VideoLibraryItem } from "@/lib/services/videos";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";
import type { CornerFeedItem } from "./corner-feed-items";

export interface CornerFeedProps {
    items: CornerFeedItem[];
    coachNames: Map<string, string>;
    sessionHref: (sessionId: string) => string;
    videoHref: (videoId: string) => string;
    filmHref: string;
    uploadHref: string;
    /** Server time (ISO). */
    now: string;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
    className?: string;
}

/** "From your corner": the newest coach notes and uploads, side by side. Server Component (takes href functions). */
export function CornerFeed({ items, coachNames, sessionHref, videoHref, filmHref, uploadHref, now, locale, className }: CornerFeedProps) {
    const t = createTranslator(locale ?? "en");
    const showsAnalysis = items.some((entry) => entry.kind === "video" && entry.item.video.status === "completed");

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                title={t("feed.title")}
                description={t("feed.description")}
                icon={<MessageSquareText />}
                action={<CardLink href={filmHref}>{t("feed.allFilm")}</CardLink>}
            />
            <CardContent className="flex flex-col gap-4">
                {items.length === 0 ? (
                    <EmptyState
                        compact
                        icon={<MessageSquareText />}
                        title={t("feed.emptyTitle")}
                        description={t("feed.emptyText")}
                        action={
                            <ButtonLink href={uploadHref} variant="secondary" size="sm">
                                <Upload aria-hidden />
                                {t("feed.uploadVideo")}
                            </ButtonLink>
                        }
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        {items.map((entry) => (
                            <li key={entry.id} className="min-w-0 rounded-lg border border-border px-4 py-3.5">
                                {entry.kind === "feedback" ? (
                                    <CoachFeedbackItem
                                        feedback={entry.feedback}
                                        coachName={coachNames.get(entry.feedback.coachId) ?? t("feed.coachFallback")}
                                        now={now}
                                        sessionHref={entry.feedback.sessionId ? sessionHref(entry.feedback.sessionId) : undefined}
                                        videoHref={entry.feedback.videoId ? videoHref(entry.feedback.videoId) : undefined}
                                        locale={locale}
                                    />
                                ) : (
                                    <UploadItem item={entry.item} href={videoHref(entry.item.video.id)} now={now} t={t} locale={locale} />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {showsAnalysis && <AINotice audience="fighter" compact locale={locale} />}
            </CardContent>
        </Card>
    );
}

function UploadItem({ item, href, now, t, locale }: { item: VideoLibraryItem; href: string; now: string; t: Translator; locale?: Locale }) {
    const { video, analysis } = item;

    return (
        <article className="flex gap-3">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai-fg">
                <TrainingTypeIcon type={video.trainingType} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-fg">{t(`feed.upload.${video.status}`)}</p>
                    <time dateTime={video.uploadedAt} title={formatDateTime(video.uploadedAt, locale)} className="text-xs text-fg-subtle">
                        {formatRelative(video.uploadedAt, now, locale)}
                    </time>
                </div>
                <p className="mt-1 text-sm text-fg">
                    <Link href={href} className="rounded-sm hover:underline">
                        {video.title}
                    </Link>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <VideoStatusBadge status={video.status} size="sm" locale={locale} />
                    {video.status === "completed" && analysis && (
                        <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-fg">
                                <Sparkles aria-hidden className="size-3.5 text-ai-fg" />
                                {plural(t, "feed.findings", analysis.findings)}
                            </span>
                            <CoachReviewStateBadge reviewed={analysis.coachReviewed} lowConfidenceCount={analysis.lowConfidenceDetections} size="sm" locale={locale} />
                        </>
                    )}
                    {video.status === "failed" && (
                        <span className="inline-flex items-center gap-1 text-xs text-danger-fg">
                            <CircleX aria-hidden className="size-3.5" />
                            {t("feed.nextSteps")}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
