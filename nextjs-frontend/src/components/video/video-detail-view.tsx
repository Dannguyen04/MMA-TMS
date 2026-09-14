import { CalendarDays, Camera, ClipboardList, Film, Sparkles, Stethoscope, Timer, TriangleAlert, Upload, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { AINotice } from "@/components/domain/ai-notice";
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
import { formatReviewCounts, reviewCounts } from "@/lib/domain/ai-review";
import { CAMERA_ANGLE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type { AIAnalysis, User } from "@/lib/domain/types";
import { formatClock, formatConfidence, formatDateTime, formatFileSize, formatNumber, formatPercent, formatRelative, pluralize } from "@/lib/format";
import { type SearchParams } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getVideoDetail, type VideoDetail } from "@/lib/services/videos";
import { clamp, cn, param } from "@/lib/utils";
import { AnalysisFailed } from "./analysis-failed";
import { AnalysisWorkspace } from "./analysis-workspace";
import { PipelineProgress } from "./pipeline-progress";
import { CoachReviewStateBadge } from "./video-badges";

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
    const detail = await loadVideoDetail(videoId);
    if (!detail || !canAccessFighter(user, detail.fighter.id)) notFound();

    const { video, fighter, job, analysis, session } = detail;
    const now = new Date().toISOString();
    const canReview = role === "coach" && hasPermission(user, "ai_findings:review");
    const canRetry = hasPermission(user, "videos:upload") && (role === "coach" || video.uploadedById === user.id || video.fighterId === user.profileId);
    const requestedMs = Number(param(searchParams.t));
    const initialMs = analysis && Number.isFinite(requestedMs) ? clamp(requestedMs, 0, analysis.durationMs) : 0;
    const sessionHref = session ? (role === "fighter" ? routes.fighter.session(session.id) : routes.coach.session(session.id)) : null;

    return (
        <>
            <PageHeader
                back={role === "fighter" ? { href: routes.fighter.videos, label: "Videos" } : { href: routes.coach.videoAnalysis, label: "Video analysis" }}
                eyebrow={
                    <span className="inline-flex items-center gap-1.5">
                        <TrainingTypeIcon type={video.trainingType} className="size-3.5" />
                        {TRAINING_TYPE_LABELS[video.trainingType]}
                    </span>
                }
                title={video.title}
                meta={
                    <>
                        {role === "coach" && (
                            <FighterIdentity fighter={fighter} size="sm" href={routes.coach.fighter(fighter.id)} showMeta={false} className="mr-2" />
                        )}
                        <VideoStatusBadge status={video.status} />
                        {analysis && <CoachReviewStateBadge reviewed={analysis.coachReview !== null} />}
                        <MetaItem icon={<CalendarDays />}>
                            <time dateTime={video.uploadedAt}>{formatDateTime(video.uploadedAt)}</time>
                        </MetaItem>
                        <MetaItem icon={<Timer />}>{formatClock(video.durationSec)}</MetaItem>
                        <MetaItem icon={<Camera />}>{CAMERA_ANGLE_LABELS[video.cameraAngle]} camera</MetaItem>
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
                            All videos of {fighter.name.split(" ")[0]}
                        </ButtonLink>
                    ) : (
                        <ButtonLink variant="secondary" href={routes.fighter.uploadVideo}>
                            <Upload aria-hidden />
                            Upload another
                        </ButtonLink>
                    )
                }
            />

            {video.status === "completed" && analysis ? (
                <AnalysisWorkspace
                    analysis={analysis}
                    video={video}
                    job={job}
                    stance={fighter.stance}
                    viewer={{ id: user.id, name: user.name }}
                    canReview={canReview}
                    initialMs={initialMs}
                    now={now}
                    summary={<AnalysisSummary analysis={analysis} role={role} />}
                />
            ) : (
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="min-w-0 lg:col-span-2">
                        {video.status === "failed" && job ? (
                            <AnalysisFailed videoId={video.id} errorCode={job.errorCode} errorMessage={job.errorMessage} attempts={job.attempts} canRetry={canRetry} />
                        ) : job && (video.status === "queued" || video.status === "processing") ? (
                            <Card>
                                <CardHeader
                                    icon={<Sparkles />}
                                    title="AI analysis in progress"
                                    description="This page updates by itself. You can leave — you'll get a notification when the analysis is ready."
                                />
                                <CardContent>
                                    <PipelineProgress jobId={job.id} initialJob={job} now={now} refreshOnSettle />
                                </CardContent>
                            </Card>
                        ) : (
                            <EmptyState icon={<Film />} title="Upload still in progress" description="The footage hasn't finished uploading yet. Check back in a moment." />
                        )}
                    </div>
                    <FootageCard detail={detail} now={now} />
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

function AnalysisSummary({ analysis, role }: { analysis: AIAnalysis; role: "fighter" | "coach" }) {
    const counts = reviewCounts(analysis);
    const [unreviewed] = formatReviewCounts({ unreviewedFindings: counts.unreviewedFindings });
    const lowOverall = analysis.overallConfidence < LOW_CONFIDENCE_THRESHOLD;
    const observations = analysis.alertIds.length;

    const stats = [
        { label: "Strikes detected", value: formatNumber(analysis.detections.length) },
        { label: "Findings", value: formatNumber(analysis.findings.length), hint: unreviewed ?? "all reviewed" },
        {
            label: "Low-confidence detections",
            value: formatNumber(counts.lowConfidenceDetections),
            hint: `unreviewed, below ${formatPercent(LOW_CONFIDENCE_THRESHOLD * 100)}`,
        },
        { label: "Tracking quality", value: formatConfidence(analysis.trackingQuality) },
    ];

    return (
        <section aria-label="AI summary" className="flex flex-col gap-3">
            <Card className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:gap-8">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <AIGeneratedBadge size="sm" label="AI summary" />
                        <ConfidenceBadge confidence={analysis.overallConfidence} size="sm" />
                    </div>
                    <p className="mt-2 text-sm text-pretty text-fg">{analysis.summary}</p>
                </div>
                <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:gap-x-8">
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
                <AINotice audience={role} compact />
                {lowOverall && (
                    <InlineNote icon={TriangleAlert} tone="warning">
                        <span className="font-semibold">Several detections need manual review.</span> Overall confidence is {formatConfidence(analysis.overallConfidence)} — low light, the camera angle
                        or a second person in frame can reduce accuracy.{" "}
                        {role === "coach" ? "Confirm or correct the flagged items before sharing." : "Your coach will check the flagged items."}
                    </InlineNote>
                )}
                {role === "coach" && observations > 0 && (
                    <InlineNote icon={Stethoscope} tone="info">
                        <span className="font-semibold">
                            {pluralize(observations, "movement observation")} {observations === 1 ? "was" : "were"} shared with the sports doctor.
                        </span>{" "}
                        The medical team reviews it; check the{" "}
                        <Link href={routes.coach.clearance} className="font-medium underline underline-offset-2">
                            Medical Clearance
                        </Link>{" "}
                        before planning intensive sessions.
                    </InlineNote>
                )}
            </div>
        </section>
    );
}

function FootageCard({ detail, now }: { detail: VideoDetail; now: string }) {
    const { video, uploadedBy, job } = detail;
    return (
        <Card className="min-w-0">
            <CardHeader title="Footage" icon={<Film />} />
            <CardContent>
                <DescriptionList
                    columns={1}
                    items={[
                        { label: "File", value: video.fileName },
                        { label: "Size", value: formatFileSize(video.fileSizeMb) },
                        { label: "Length", value: formatClock(video.durationSec) },
                        { label: "Resolution", value: `${video.resolution} · ${video.fps} fps` },
                        { label: "Camera angle", value: CAMERA_ANGLE_LABELS[video.cameraAngle] },
                        { label: "Uploaded", value: `${formatRelative(video.uploadedAt, now)} by ${uploadedBy?.name ?? "a team member"}` },
                        ...(job ? [{ label: "Job", value: `${job.id} · attempt ${job.attempts}` }] : []),
                        ...(video.notes ? [{ label: "Notes", value: video.notes }] : []),
                    ]}
                />
            </CardContent>
        </Card>
    );
}
