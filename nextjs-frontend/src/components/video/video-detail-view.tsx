import { CalendarDays, Camera, ClipboardList, Film, Sparkles, Stethoscope, Timer, TriangleAlert, Upload, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { AINotice } from "@/components/domain/ai-notice";
import { formatVideoResolution } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { AIGeneratedBadge, ConfidenceBadge, VideoStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { canAccessFighter } from "@/lib/auth/access";
import { hasPermission } from "@/lib/auth/session";
import { reviewCounts } from "@/lib/domain/ai-review";
import { trainingTypeLabel } from "@/lib/domain/labels";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type { AIAnalysis, User } from "@/lib/domain/types";
import { formatClock, formatConfidence, formatDateTime, formatFileSize, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { type SearchParams } from "@/lib/query";
import { routes } from "@/lib/routes";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getVideoDetail, type VideoDetail } from "@/lib/services/videos";
import { clamp, cn, param } from "@/lib/utils";
import { AnalysisFailed } from "./analysis-failed";
import { AnalysisWorkspace } from "./analysis-workspace";
import { PipelineProgress } from "./pipeline-progress";
import { CoachReviewStateBadge } from "./video-badges";
import { analysisSummary, cameraAngleLabel, confidencePct, reviewCountParts, splitPlaceholder } from "./video-copy";

export interface VideoDetailViewProps {
    user: User;
    videoId: string;
    role: "fighter" | "coach";
    searchParams: SearchParams;
}

/** Request-scoped video read, shared by a detail page's generateMetadata and its render. */
export const loadVideoDetail = cache(getVideoDetail);

/** Shared server view for a video: header, then the analysis workspace or the processing / failed state. */
export async function VideoDetailView({ user, videoId, role, searchParams }: VideoDetailViewProps) {
    const [detail, { t, locale }] = await Promise.all([loadVideoDetail(videoId), getTranslator()]);
    if (!detail || !canAccessFighter(user, detail.fighter.id)) notFound();

    const { video, fighter, job, analysis, session } = detail;
    const now = new Date().toISOString();
    const canReview = role === "coach" && hasPermission(user, "ai_findings:review");
    const canRetry =
        platformFeatureAvailable("aiJobControl") &&
        hasPermission(user, "videos:upload") &&
        (role === "coach" || video.uploadedById === user.id || video.fighterId === user.profileId);
    const requestedMs = Number(param(searchParams.t));
    const initialMs = analysis && Number.isFinite(requestedMs) ? clamp(requestedMs, 0, analysis.durationMs) : 0;
    const sessionHref = session ? (role === "fighter" ? routes.fighter.session(session.id) : routes.coach.session(session.id)) : null;

    return (
        <>
            <PageHeader
                back={
                    role === "fighter"
                        ? { href: routes.fighter.videos, label: t("screens.video.page.film") }
                        : { href: routes.coach.videoAnalysis, label: t("screens.video.page.filmRoom") }
                }
                eyebrow={
                    <span className="inline-flex items-center gap-1.5">
                        <TrainingTypeIcon type={video.trainingType} className="size-3.5" />
                        {trainingTypeLabel(t, video.trainingType)}
                    </span>
                }
                title={video.title}
                meta={
                    <>
                        {role === "coach" && (
                            <FighterIdentity fighter={fighter} size="sm" href={routes.coach.fighter(fighter.id)} showMeta={false} className="mr-2" />
                        )}
                        <VideoStatusBadge status={video.status} locale={locale} />
                        {analysis && <CoachReviewStateBadge reviewed={analysis.coachReview !== null} locale={locale} />}
                        <MetaItem icon={<CalendarDays />}>
                            <time dateTime={video.uploadedAt}>{formatDateTime(video.uploadedAt, locale)}</time>
                        </MetaItem>
                        <MetaItem icon={<Timer />}>{formatClock(video.durationSec)}</MetaItem>
                        <MetaItem icon={<Camera />}>{t("screens.video.detail.cameraMeta", { angle: cameraAngleLabel(t, video.cameraAngle) })}</MetaItem>
                        {session && sessionHref && (
                            <MetaItem icon={<ClipboardList />}>
                                <Link href={sessionHref} className="underline-offset-2 hover:text-fg hover:underline">
                                    {session.title}
                                </Link>
                            </MetaItem>
                        )}
                    </>
                }
                actions={
                    role === "coach" ? (
                        <ButtonLink variant="secondary" href={routes.coach.fighterVideos(fighter.id)}>
                            <Users aria-hidden />
                            {t("screens.video.detail.allVideosOf", { name: fighter.name.split(" ")[0] })}
                        </ButtonLink>
                    ) : (
                        <ButtonLink variant="secondary" href={routes.fighter.uploadVideo}>
                            <Upload aria-hidden />
                            {t("screens.video.detail.uploadAnother")}
                        </ButtonLink>
                    )
                }
            />

            {video.status === "completed" && analysis ? (
                <AnalysisWorkspace
                    analysis={analysis}
                    video={video}
                    job={job}
                    stance={fighter.stance ?? "orthodox"}
                    viewer={{ id: user.id, name: user.name }}
                    canReview={canReview}
                    initialMs={initialMs}
                    now={now}
                    summary={<AnalysisSummary analysis={analysis} role={role} t={t} locale={locale} />}
                />
            ) : (
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="min-w-0 lg:col-span-2">
                        {video.status === "failed" && job ? (
                            <AnalysisFailed videoId={video.id} errorCode={job.errorCode} errorMessage={job.errorMessage} attempts={job.attempts} canRetry={canRetry} />
                        ) : job && (video.status === "queued" || video.status === "processing") ? (
                            <Card>
                                <CardHeader icon={<Sparkles />} title={t("screens.video.aiAnalysisInProgress")} description={t("screens.video.detail.inProgressDesc")} />
                                <CardContent>
                                    <PipelineProgress jobId={job.id} initialJob={job} now={now} refreshOnSettle />
                                </CardContent>
                            </Card>
                        ) : (
                            <EmptyState icon={<Film />} title={t("screens.video.detail.uploadPending")} description={t("screens.video.detail.uploadPendingDesc")} />
                        )}
                    </div>
                    <FootageCard detail={detail} now={now} t={t} locale={locale} />
                </div>
            )}
        </>
    );
}

function MetaItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
            <span aria-hidden className="text-fg-subtle [&_svg]:size-3.5">
                {icon}
            </span>
            {children}
        </span>
    );
}

function AnalysisSummary({ analysis, role, t, locale }: { analysis: AIAnalysis; role: "fighter" | "coach"; t: Translator; locale: Locale }) {
    const counts = reviewCounts(analysis);
    const [unreviewed] = reviewCountParts(t, { unreviewedFindings: counts.unreviewedFindings });
    const confidenceAvailable = analysis.confidenceAvailable !== false;
    const coachingEligible = analysis.coachingEligible !== false;
    const lowOverall = !confidenceAvailable || analysis.overallConfidence === null || analysis.overallConfidence < LOW_CONFIDENCE_THRESHOLD;
    const observations = analysis.alertIds.length;
    const [beforeLink, afterLink] = splitPlaceholder(t("screens.video.summary.observationsBody"), "link");

    const stats = analysis.movementEvidence ? [
        { label: t("screens.video.summary.reviewWindows"), value: formatNumber(analysis.movementEvidence.windows.length), hint: t("screens.video.summary.notRepetitions") },
        { label: t("screens.video.summary.usableFrames"), value: `${analysis.movementEvidence.coverage.usableFrames} / ${analysis.movementEvidence.coverage.totalFrames}`, hint: t("screens.video.summary.visibilityOnly") },
    ] : [
        { label: t("screens.video.summary.strikeCandidates"), value: formatNumber(analysis.detections.length) },
        { label: t("screens.video.summary.findings"), value: formatNumber(analysis.findings.length), hint: unreviewed ?? t("screens.video.summary.allReviewed") },
        {
            label: t("screens.video.summary.lowConfidenceDetections"),
            value: formatNumber(counts.lowConfidenceDetections),
            hint: t("screens.video.summary.unreviewedBelow", { pct: formatPercent(LOW_CONFIDENCE_THRESHOLD * 100) }),
        },
        { label: t("screens.video.summary.framesTracked"), value: formatConfidence(analysis.trackingQuality), hint: t("screens.video.summary.notAccuracy") },
        ...(analysis.poseConfidence !== undefined
            ? [{ label: t("screens.video.summary.poseConfidence"), value: analysis.poseConfidence === null ? t("screens.video.unavailable") : formatConfidence(analysis.poseConfidence) }]
            : []),
    ];

    return (
        <section aria-label={t("screens.video.summary.label")} className="flex flex-col gap-3">
            <Card className={cn("flex flex-col gap-4 px-5 py-4", stats.length <= 4 && "lg:flex-row lg:items-center lg:gap-8")}>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <AIGeneratedBadge size="sm" label={t("screens.video.summary.label")} />
                        {confidenceAvailable ? (
                            <ConfidenceBadge confidence={analysis.overallConfidence} size="sm" locale={locale} />
                        ) : (
                            <span className="text-xs font-semibold text-warning">{t("screens.video.summary.confidenceUnavailable")}</span>
                        )}
                    </div>
                    <p className="mt-2 text-sm text-pretty text-fg">{analysisSummary(t, analysis.summary)}</p>
                </div>
                <dl className={cn("grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 lg:gap-x-8", stats.length <= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-5")}>
                    {stats.map((stat) => (
                        <div key={stat.label} className="min-w-0">
                            <dt className="text-xs text-fg-muted">{stat.label}</dt>
                            <dd className="mt-0.5 text-lg leading-tight font-semibold text-fg">
                                {stat.value}
                                {stat.hint && <span className="block text-xs font-normal text-fg-subtle">{stat.hint}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            </Card>
            <div className={cn("grid grid-cols-1 gap-3", (lowOverall || (role === "coach" && observations > 0)) && "lg:grid-cols-2")}>
                <AINotice audience={role} compact locale={locale} />
                {!coachingEligible && (
                    <InlineNote icon={TriangleAlert} tone="warning">
                        <span className="font-semibold">{t("screens.video.summary.notEligibleTitle")}</span>{" "}
                        {t("screens.video.summary.notEligibleBody", { quality: t(`screens.video.evidenceQuality.${analysis.evidenceQuality ?? "unknown"}`) })}
                    </InlineNote>
                )}
                {lowOverall && (
                    <InlineNote icon={TriangleAlert} tone="warning">
                        <span className="font-semibold">{t("screens.video.summary.lowTitle")}</span>{" "}
                        {t("screens.video.summary.lowBody", {
                            confidence: confidenceAvailable
                                ? t("screens.video.summary.overallConfidence", { pct: confidencePct(t, analysis.overallConfidence) })
                                : t("screens.video.summary.noCalibration"),
                            next: role === "coach" ? t("screens.video.summary.coachNext") : t("screens.video.summary.fighterNext"),
                        })}
                    </InlineNote>
                )}
                {role === "coach" && observations > 0 && (
                    <InlineNote icon={Stethoscope} tone="info">
                        <span className="font-semibold">{plural(t, "screens.video.summary.observations", observations)}</span> {beforeLink}
                        <Link href={routes.coach.clearance} className="font-medium underline underline-offset-2">
                            {t("screens.video.summary.medicalClearance")}
                        </Link>
                        {afterLink}
                    </InlineNote>
                )}
            </div>
        </section>
    );
}

function FootageCard({ detail, now, t, locale }: { detail: VideoDetail; now: string; t: Translator; locale: Locale }) {
    const { video, uploadedBy, job } = detail;
    return (
        <Card className="min-w-0">
            <CardHeader title={t("screens.video.footage.title")} icon={<Film />} />
            <CardContent>
                <DescriptionList
                    columns={1}
                    items={[
                        { label: t("screens.video.fileLabel"), value: video.fileName },
                        { label: t("screens.video.footage.size"), value: formatFileSize(video.fileSizeMb) },
                        { label: t("screens.video.footage.length"), value: formatClock(video.durationSec) },
                        { label: t("screens.video.footage.resolution"), value: formatVideoResolution(video) },
                        { label: t("screens.video.cameraAngle"), value: cameraAngleLabel(t, video.cameraAngle) },
                        {
                            label: t("screens.video.footage.uploaded"),
                            value: t("screens.video.footage.uploadedBy", { when: formatRelative(video.uploadedAt, now, locale), name: uploadedBy?.name ?? t("screens.video.footage.teamMember") }),
                        },
                        ...(job ? [{ label: t("screens.video.job"), value: t("screens.video.footage.jobAttempt", { id: job.id, n: job.attempts }) }] : []),
                        ...(video.notes ? [{ label: t("screens.video.footage.notes"), value: video.notes }] : []),
                    ]}
                />
            </CardContent>
        </Card>
    );
}
