import { BrainCircuit, ChartNoAxesColumn, CircleCheck, CircleX, Film, History, Lightbulb, ListChecks, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { cameraAngleLabel, countLabel, formatDurationSec, modelTaskLabel, pipelineStageLabel, splitAround } from "@/components/admin/admin-format";
import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { JobActions } from "@/components/admin/job-actions";
import { jobGuidance } from "@/components/admin/job-guidance";
import { PipelineTimeline } from "@/components/admin/pipeline-timeline";
import { RefreshControl } from "@/components/admin/refresh-control";
import { InlineNote } from "@/components/dashboard/inline-note";
import { AINotice } from "@/components/domain/ai-notice";
import { ConfidenceMeter } from "@/components/domain/confidence-meter";
import { formatVideoResolution, NOT_RECORDED } from "@/components/domain/domain-format";
import { MetricTile } from "@/components/domain/metric-tile";
import { AIGeneratedBadge, AIJobStatusBadge, LowConfidenceBadge, VideoStatusBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { trainingTypeLabel } from "@/lib/domain/labels";
import { formatClock, formatConfidence, formatDateTime, formatFileSize, formatPercent, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getAIJobDetail } from "@/lib/services/ai";
import { getUser } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

const AUTO_REFRESH_MS = 5_000;

/** One read per request, shared by the metadata and the page. */
const loadJobDetail = cache((jobId: string) => getAIJobDetail(jobId));

/** The job and the account that uploaded its footage, the uploader read as soon as the job is known. */
async function loadJobWithUploader(jobId: string) {
    const detail = await loadJobDetail(jobId);
    const uploader = detail?.video ? await getUser(detail.video.uploadedById) : null;
    return { detail, uploader };
}

export async function generateMetadata({ params }: PageProps<"/admin/ai-jobs/[jobId]">): Promise<Metadata> {
    await requireRole("admin");
    const { t } = await getTranslator();
    const { jobId } = await params;
    const detail = await loadJobDetail(jobId);
    return { title: detail ? t("screens.admin.meta.job", { id: detail.job.id }) : t("screens.admin.meta.jobNotFound") };
}

export default async function AdminAIJobDetailPage({ params }: PageProps<"/admin/ai-jobs/[jobId]">) {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    const { jobId } = await params;
    const now = new Date().toISOString();

    const [{ detail, uploader }, settings] = await Promise.all([loadJobWithUploader(jobId), getSettings()]);
    if (!detail) notFound();
    const { job, video, fighter, models, analysis, otherRuns } = detail;

    const inFlight = job.status === "queued" || job.status === "processing";
    // A later run already processed this footage (or the footage is gone), so re-queuing this one would only overwrite it.
    const supersededBy = job.status === "failed" && video && video.jobId !== null && video.jobId !== job.id ? video.jobId : null;
    const insights = platformFeatureAvailable("aiJobInsights");
    const canAct = platformFeatureAvailable("aiJobControl") && !(job.status === "failed" && (supersededBy !== null || video === null));
    const guidance = jobGuidance(job.errorCode, locale);
    const videoTitle = video?.title ?? t("screens.admin.common.videoRemoved");
    const stage = pipelineStageLabel(t, job.stage);
    const [resolvedBefore, resolvedAfter] = splitAround(t("screens.admin.job.resolvedBy"), "job");
    const [workerBefore, workerAfter] = splitAround(t("screens.admin.job.onWorker"), "worker");
    const resolution = video ? formatVideoResolution(video) : "";

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.aiJobs, label: t("screens.admin.common.aiJobs") }}
                eyebrow={t("screens.admin.job.eyebrow")}
                title={videoTitle}
                description={
                    <>
                        <code className="font-mono text-[14px] text-fg">{job.id}</code>
                        {fighter && <> · {fighter.name}</>}
                        {video && <> · {trainingTypeLabel(t, video.trainingType)}</>}
                    </>
                }
                meta={
                    <>
                        <AIJobStatusBadge locale={locale} status={job.status} />
                        {job.lowConfidence && <LowConfidenceBadge locale={locale} />}
                        <Badge tone="neutral" variant="outline">
                            {t("screens.admin.job.attempt", { n: job.attempts })}
                        </Badge>
                    </>
                }
                actions={
                    <>
                        {inFlight && <RefreshControl renderedAt={now} autoRefreshMs={AUTO_REFRESH_MS} />}
                        {canAct && <JobActions jobId={job.id} status={job.status} attempts={job.attempts} videoTitle={videoTitle} retryHelps={guidance.retryHelps} />}
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    {job.status === "failed" && (
                        <Card className="border-danger-border">
                            <CardHeader
                                title={guidance.title}
                                description={[
                                    t("screens.admin.common.failed"),
                                    job.finishedAt ? formatRelative(job.finishedAt, now, locale) : null,
                                    t("screens.admin.job.failedAt", { stage: stage.toLowerCase() }),
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                icon={<CircleX className="text-danger-fg" />}
                            />
                            <CardContent className="flex flex-col gap-4">
                                <div className="rounded-lg bg-danger-soft/60 px-4 py-3 ring-1 ring-danger-border ring-inset">
                                    <p className="font-mono text-xs font-semibold text-danger-fg">{job.errorCode ?? "UNKNOWN_ERROR"}</p>
                                    <p className="mt-1 font-mono text-[13px] break-words text-fg">{job.errorMessage ?? t("screens.admin.job.noErrorMessage")}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="flex gap-3">
                                        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium text-fg">{t("screens.admin.job.whatHappened")}</h3>
                                            <p className="mt-0.5 text-[13px] text-fg-muted">{guidance.explanation}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Wrench aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium text-fg">{t("screens.admin.job.suggestedFix")}</h3>
                                            <p className="mt-0.5 text-[13px] text-fg-muted">{guidance.suggestedFix}</p>
                                        </div>
                                    </div>
                                </div>
                                {supersededBy ? (
                                    <InlineNote icon={CircleCheck} tone="success">
                                        {resolvedBefore}
                                        <Link href={routes.admin.aiJob(supersededBy)} className="font-mono font-medium underline-offset-2 hover:underline">
                                            {supersededBy}
                                        </Link>
                                        {resolvedAfter}
                                    </InlineNote>
                                ) : video === null ? (
                                    <p className="text-[13px] text-fg-subtle">{t("screens.admin.job.footageDeleted")}</p>
                                ) : (
                                    <p className="text-[13px] text-fg-subtle">
                                        {guidance.retryHelps ? t("screens.admin.job.retryLikely") : t("screens.admin.job.retryUnlikely")}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {job.status === "processing" && (
                        <Card>
                            <CardContent className="pt-4">
                                <ProgressBar value={job.progressPct} label={stage} showLabel valueText={t("screens.admin.job.percentComplete", { n: job.progressPct })} />
                                <p className="mt-2 text-[13px] text-fg-muted">
                                    {job.startedAt ? t("screens.admin.job.started", { when: formatRelative(job.startedAt, now, locale) }) : t("screens.admin.job.starting")}
                                    {job.workerId && (
                                        <>
                                            {" "}
                                            {workerBefore}
                                            <code className="font-mono">{job.workerId}</code>
                                            {workerAfter}
                                        </>
                                    )}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader title={t("screens.admin.job.pipeline")} description={t("screens.admin.job.pipelineDescription")} icon={<ListChecks />} />
                        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
                            <PipelineTimeline job={job} locale={locale} />
                            <div className="min-w-0 border-t border-border pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                                <h3 className="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t("screens.admin.job.timings")}</h3>
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: t("screens.admin.common.queued"), value: <TimeValue iso={job.queuedAt} now={now} locale={locale} /> },
                                        {
                                            label: t("screens.admin.job.startedLabel"),
                                            value: job.startedAt ? <TimeValue iso={job.startedAt} now={now} locale={locale} /> : t("screens.admin.job.notStarted"),
                                        },
                                        { label: t("screens.admin.job.finishedLabel"), value: job.finishedAt ? <TimeValue iso={job.finishedAt} now={now} locale={locale} /> : "—" },
                                        { label: t("screens.admin.job.processingTime"), value: job.durationSec !== null ? formatDurationSec(job.durationSec, locale) : "—" },
                                        {
                                            label: t("screens.admin.job.worker"),
                                            value: job.workerId ? <code className="font-mono text-[13px]">{job.workerId}</code> : t("screens.admin.job.notAssigned"),
                                        },
                                        { label: t("screens.admin.common.attempts"), value: job.attempts },
                                    ]}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {insights && job.status === "completed" && (
                        <Card>
                            <CardHeader
                                title={t("screens.admin.job.summary")}
                                description={t("screens.admin.job.summaryDescription")}
                                icon={<ChartNoAxesColumn />}
                                action={<AIGeneratedBadge size="sm" locale={locale} />}
                            />
                            <CardContent className="flex flex-col gap-5">
                                {analysis ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <MetricTile label={t("screens.admin.job.detections")} value={analysis.detectionCount} locale={locale} />
                                            <MetricTile
                                                label={t("screens.admin.job.lowConfidence")}
                                                value={analysis.lowConfidenceDetectionCount}
                                                hint={t("screens.admin.job.below", { pct: formatPercent(settings.aiLowConfidenceThreshold * 100) })}
                                                locale={locale}
                                            />
                                            <MetricTile label={t("screens.admin.job.combinations")} value={analysis.combinationCount} locale={locale} />
                                            <MetricTile label={t("screens.admin.job.findings")} value={analysis.findingCount} hint={t("screens.admin.job.forCoachReview")} locale={locale} />
                                        </div>
                                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                            <div>
                                                <p className="mb-2 text-sm font-medium text-fg">{t("screens.admin.job.overallConfidence")}</p>
                                                <ConfidenceMeter
                                                    confidence={analysis.overallConfidence}
                                                    label={t("screens.admin.job.overallConfidenceLabel")}
                                                    lowThreshold={settings.aiLowConfidenceThreshold}
                                                    locale={locale}
                                                />
                                            </div>
                                            <ProgressBar
                                                value={Math.round(analysis.trackingQuality * 100)}
                                                label={t("screens.admin.job.trackingQuality")}
                                                showLabel
                                                tone={analysis.trackingQuality < 0.8 ? "warning" : "success"}
                                                valueText={t("screens.admin.job.framesTracked", { pct: formatConfidence(analysis.trackingQuality) })}
                                            />
                                        </div>
                                        <p className="text-[13px] text-fg-muted">
                                            {t("screens.admin.job.footage", {
                                                clock: formatClock(analysis.durationMs / 1000),
                                                fps: Math.round(analysis.fps),
                                                date: formatDateTime(analysis.processedAt, locale),
                                            })}
                                        </p>
                                        <AINotice audience="admin" compact locale={locale} />
                                    </>
                                ) : (
                                    <EmptyState
                                        compact
                                        title={t("screens.admin.job.analysisUnavailableTitle")}
                                        description={t("screens.admin.job.analysisUnavailableDescription")}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {insights && (
                        <Card className="overflow-hidden">
                            <CardHeader
                                title={t("screens.admin.job.otherRuns")}
                                description={
                                    otherRuns.length === 0
                                        ? t("screens.admin.job.onlyRun")
                                        : t("screens.admin.job.otherRunsDescription", { runs: countLabel(t, "screens.admin.count.otherRuns", otherRuns.length) })
                                }
                                icon={<History />}
                            />
                            {otherRuns.length === 0 ? (
                                <CardContent>
                                    <p className="text-sm text-fg-muted">{t("screens.admin.job.noOtherRuns")}</p>
                                </CardContent>
                            ) : (
                                <div className="border-t border-border">
                                    <Table caption={t("screens.admin.job.otherRunsCaption")}>
                                        <THead>
                                            <tr>
                                                <TH>{t("screens.admin.common.job")}</TH>
                                                <TH>{t("screens.admin.common.status")}</TH>
                                                <TH className="text-right">{t("screens.admin.common.attempts")}</TH>
                                                <TH>{t("screens.admin.common.queued")}</TH>
                                                <TH>{t("screens.admin.common.duration")}</TH>
                                                <TH>{t("screens.admin.job.error")}</TH>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {otherRuns.map((run) => (
                                                <TR key={run.id}>
                                                    <TD className="whitespace-nowrap">
                                                        <Link href={routes.admin.aiJob(run.id)} className="font-mono text-[13px] text-primary-soft-fg hover:underline">
                                                            {run.id}
                                                        </Link>
                                                    </TD>
                                                    <TD>
                                                        <AIJobStatusBadge locale={locale} status={run.status} size="sm" />
                                                    </TD>
                                                    <TD className="text-right">{run.attempts}</TD>
                                                    <TD className="whitespace-nowrap text-fg-muted">{formatDateTime(run.queuedAt, locale)}</TD>
                                                    <TD className="text-fg-muted">{run.durationSec !== null ? formatDurationSec(run.durationSec, locale) : "—"}</TD>
                                                    <TD>
                                                        {run.errorCode ? <code className="font-mono text-xs text-danger-fg">{run.errorCode}</code> : <span className="text-fg-subtle">—</span>}
                                                    </TD>
                                                </TR>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader
                            title={t("screens.admin.common.video")}
                            icon={<Film />}
                            action={video ? <VideoStatusBadge status={video.status} size="sm" locale={locale} /> : undefined}
                        />
                        <CardContent>
                            {video ? (
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: t("screens.admin.job.fighter"), value: fighter?.name ?? t("screens.admin.common.unknownFighter") },
                                        {
                                            label: t("screens.admin.job.trainingType"),
                                            value: t("screens.admin.job.trainingTypeValue", {
                                                type: trainingTypeLabel(t, video.trainingType),
                                                angle: cameraAngleLabel(t, video.cameraAngle),
                                            }),
                                        },
                                        { label: t("screens.admin.job.file"), value: <code className="font-mono text-[13px] break-all">{video.fileName}</code> },
                                        { label: t("screens.admin.job.sizeLength"), value: `${formatFileSize(video.fileSizeMb)} · ${formatClock(video.durationSec)}` },
                                        { label: t("screens.admin.job.resolution"), value: resolution === NOT_RECORDED ? t("screens.admin.common.notRecorded") : resolution },
                                        {
                                            label: t("screens.admin.job.uploaded"),
                                            value: uploader
                                                ? t("screens.admin.job.uploadedBy", { date: formatDateTime(video.uploadedAt, locale), name: uploader.name })
                                                : formatDateTime(video.uploadedAt, locale),
                                        },
                                    ]}
                                />
                            ) : (
                                <EmptyState compact title={t("screens.admin.common.videoRemoved")} description={t("screens.admin.job.videoRemovedDescription")} />
                            )}
                        </CardContent>
                        {video && (
                            <CardFooter>
                                <span className="text-fg-muted">{t("screens.admin.job.storage")}</span>
                                <Link href={hrefWith(routes.admin.videos, {}, { q: video.fileName })} className="font-medium text-primary-soft-fg hover:underline">
                                    {t("screens.admin.job.manageVideo")}
                                </Link>
                            </CardFooter>
                        )}
                    </Card>

                    {insights && (
                        <Card className="overflow-hidden">
                            <CardHeader title={t("screens.admin.job.modelsUsed")} description={countLabel(t, "screens.admin.count.models", models.length)} icon={<BrainCircuit />} />
                            {models.length === 0 ? (
                                <CardContent>
                                    <p className="text-sm text-fg-muted">{t("screens.admin.job.modelsPending")}</p>
                                </CardContent>
                            ) : (
                                <ul className="divide-y divide-border border-t border-border">
                                    {models.map((model) => (
                                        <li key={model.id} className="px-5 py-3">
                                            <p className="text-xs text-fg-subtle">{modelTaskLabel(t, model.task)}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                                                <Link href={routes.admin.aiModel(model.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                                    {model.name} <span className="font-mono text-[13px] text-fg-muted">{model.version}</span>
                                                </Link>
                                                <ModelStatusBadge status={model.status} size="sm" locale={locale} />
                                            </div>
                                            <p className="mt-0.5 text-xs text-fg-muted">
                                                {t("screens.admin.job.modelLatency", { ms: model.avgLatencyMs, pct: formatConfidence(model.lowConfidenceThreshold) })}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}

function TimeValue({ iso, now, locale }: { iso: string; now: string; locale: Locale }) {
    return (
        <time dateTime={iso} title={formatRelative(iso, now, locale)}>
            {formatDateTime(iso, locale)}
        </time>
    );
}
