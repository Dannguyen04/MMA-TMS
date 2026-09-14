import { BrainCircuit, ChartNoAxesColumn, CircleCheck, CircleX, Film, History, Lightbulb, ListChecks, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { formatDurationSec } from "@/components/admin/admin-format";
import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { JobActions } from "@/components/admin/job-actions";
import { jobGuidance } from "@/components/admin/job-guidance";
import { PipelineTimeline } from "@/components/admin/pipeline-timeline";
import { RefreshControl } from "@/components/admin/refresh-control";
import { InlineNote } from "@/components/dashboard/inline-note";
import { AINotice } from "@/components/domain/ai-notice";
import { ConfidenceMeter } from "@/components/domain/confidence-meter";
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
import { AI_MODEL_TASK_LABELS, CAMERA_ANGLE_LABELS, PIPELINE_STAGE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { formatClock, formatConfidence, formatDateTime, formatFileSize, formatPercent, formatRelative, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getAIJobDetail } from "@/lib/services/ai";
import { getUser } from "@/lib/services/people";

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
    const { jobId } = await params;
    const detail = await loadJobDetail(jobId);
    return { title: detail ? `Job ${detail.job.id}` : "Job not found" };
}

export default async function AdminAIJobDetailPage({ params }: PageProps<"/admin/ai-jobs/[jobId]">) {
    await requireRole("admin");
    const { jobId } = await params;
    const now = new Date().toISOString();

    const [{ detail, uploader }, settings] = await Promise.all([loadJobWithUploader(jobId), getSettings()]);
    if (!detail) notFound();
    const { job, video, fighter, models, analysis, otherRuns } = detail;

    const inFlight = job.status === "queued" || job.status === "processing";
    // A later run already processed this footage (or the footage is gone), so re-queuing this one would only overwrite it.
    const supersededBy = job.status === "failed" && video && video.jobId !== null && video.jobId !== job.id ? video.jobId : null;
    const canAct = !(job.status === "failed" && (supersededBy !== null || video === null));
    const guidance = jobGuidance(job.errorCode);
    const videoTitle = video?.title ?? "Video removed";

    return (
        <>
            <PageHeader
                back={{ href: routes.admin.aiJobs, label: "AI jobs" }}
                eyebrow="AI processing job"
                title={videoTitle}
                description={
                    <>
                        <code className="font-mono text-[14px] text-fg">{job.id}</code>
                        {fighter && <> · {fighter.name}</>}
                        {video && <> · {TRAINING_TYPE_LABELS[video.trainingType]}</>}
                    </>
                }
                meta={
                    <>
                        <AIJobStatusBadge status={job.status} />
                        {job.lowConfidence && <LowConfidenceBadge />}
                        <Badge tone="neutral" variant="outline">
                            Attempt {job.attempts}
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
                                    "Failed",
                                    job.finishedAt ? formatRelative(job.finishedAt, now) : null,
                                    `at ${PIPELINE_STAGE_LABELS[job.stage].toLowerCase()}`,
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                icon={<CircleX className="text-danger-fg" />}
                            />
                            <CardContent className="flex flex-col gap-4">
                                <div className="rounded-lg bg-danger-soft/60 px-4 py-3 ring-1 ring-danger-border ring-inset">
                                    <p className="font-mono text-xs font-semibold text-danger-fg">{job.errorCode ?? "UNKNOWN_ERROR"}</p>
                                    <p className="mt-1 font-mono text-[13px] break-words text-fg">{job.errorMessage ?? "The worker didn't report an error message."}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="flex gap-3">
                                        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium text-fg">What happened</h3>
                                            <p className="mt-0.5 text-[13px] text-fg-muted">{guidance.explanation}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Wrench aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium text-fg">Suggested fix</h3>
                                            <p className="mt-0.5 text-[13px] text-fg-muted">{guidance.suggestedFix}</p>
                                        </div>
                                    </div>
                                </div>
                                {supersededBy ? (
                                    <InlineNote icon={CircleCheck} tone="success">
                                        Resolved by a later run —{" "}
                                        <Link href={routes.admin.aiJob(supersededBy)} className="font-mono font-medium underline-offset-2 hover:underline">
                                            {supersededBy}
                                        </Link>{" "}
                                        processed this footage, so this attempt doesn&apos;t need a retry.
                                    </InlineNote>
                                ) : video === null ? (
                                    <p className="text-[13px] text-fg-subtle">The footage was deleted, so this job can&apos;t be retried.</p>
                                ) : (
                                    <p className="text-[13px] text-fg-subtle">
                                        {guidance.retryHelps ? "A retry is likely to succeed." : "A retry on the same file is unlikely to succeed."}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {job.status === "processing" && (
                        <Card>
                            <CardContent className="pt-4">
                                <ProgressBar
                                    value={job.progressPct}
                                    label={PIPELINE_STAGE_LABELS[job.stage]}
                                    showLabel
                                    valueText={`${job.progressPct}% complete`}
                                />
                                <p className="mt-2 text-[13px] text-fg-muted">
                                    {job.startedAt ? `Started ${formatRelative(job.startedAt, now)}` : "Starting"}
                                    {job.workerId && <> on <code className="font-mono">{job.workerId}</code></>}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader title="Pipeline" description="Stages run in order for every analysis" icon={<ListChecks />} />
                        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
                            <PipelineTimeline job={job} />
                            <div className="min-w-0 border-t border-border pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                                <h3 className="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Timings</h3>
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: "Queued", value: <TimeValue iso={job.queuedAt} now={now} /> },
                                        { label: "Started", value: job.startedAt ? <TimeValue iso={job.startedAt} now={now} /> : "Not started" },
                                        { label: "Finished", value: job.finishedAt ? <TimeValue iso={job.finishedAt} now={now} /> : "—" },
                                        { label: "Processing time", value: job.durationSec !== null ? formatDurationSec(job.durationSec) : "—" },
                                        { label: "Worker", value: job.workerId ? <code className="font-mono text-[13px]">{job.workerId}</code> : "Not assigned" },
                                        { label: "Attempts", value: job.attempts },
                                    ]}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {job.status === "completed" && (
                        <Card>
                            <CardHeader
                                title="Analysis summary"
                                description="Operational figures only — findings are reviewed by coaches"
                                icon={<ChartNoAxesColumn />}
                                action={<AIGeneratedBadge size="sm" />}
                            />
                            <CardContent className="flex flex-col gap-5">
                                {analysis ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <MetricTile label="Detections" value={analysis.detectionCount} />
                                            <MetricTile
                                                label="Low-confidence"
                                                value={analysis.lowConfidenceDetectionCount}
                                                hint={`below ${formatPercent(settings.aiLowConfidenceThreshold * 100)}`}
                                            />
                                            <MetricTile label="Combinations" value={analysis.combinationCount} />
                                            <MetricTile label="Findings" value={analysis.findingCount} hint="for coach review" />
                                        </div>
                                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                            <div>
                                                <p className="mb-2 text-sm font-medium text-fg">Overall confidence</p>
                                                <ConfidenceMeter confidence={analysis.overallConfidence} label="Overall analysis confidence" lowThreshold={settings.aiLowConfidenceThreshold} />
                                            </div>
                                            <ProgressBar
                                                value={Math.round(analysis.trackingQuality * 100)}
                                                label="Tracking quality"
                                                showLabel
                                                tone={analysis.trackingQuality < 0.8 ? "warning" : "success"}
                                                valueText={`${formatConfidence(analysis.trackingQuality)} of frames tracked`}
                                            />
                                        </div>
                                        <p className="text-[13px] text-fg-muted">
                                            {formatClock(analysis.durationMs / 1000)} of footage at {Math.round(analysis.fps)} fps · processed {formatDateTime(analysis.processedAt)}
                                        </p>
                                        <AINotice audience="admin" compact />
                                    </>
                                ) : (
                                    <EmptyState compact title="Analysis not available" description="The analysis for this job was removed with its video." />
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="overflow-hidden">
                        <CardHeader
                            title="Other runs of this video"
                            description={otherRuns.length === 0 ? "This is the only run" : `${pluralize(otherRuns.length, "other run")}, newest first`}
                            icon={<History />}
                        />
                        {otherRuns.length === 0 ? (
                            <CardContent>
                                <p className="text-sm text-fg-muted">No other jobs were created for this footage.</p>
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <Table caption="Other jobs for the same video">
                                    <THead>
                                        <tr>
                                            <TH>Job</TH>
                                            <TH>Status</TH>
                                            <TH className="text-right">Attempts</TH>
                                            <TH>Queued</TH>
                                            <TH>Duration</TH>
                                            <TH>Error</TH>
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
                                                    <AIJobStatusBadge status={run.status} size="sm" />
                                                </TD>
                                                <TD className="text-right">{run.attempts}</TD>
                                                <TD className="whitespace-nowrap text-fg-muted">{formatDateTime(run.queuedAt)}</TD>
                                                <TD className="text-fg-muted">{run.durationSec !== null ? formatDurationSec(run.durationSec) : "—"}</TD>
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
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader title="Video" icon={<Film />} action={video ? <VideoStatusBadge status={video.status} size="sm" /> : undefined} />
                        <CardContent>
                            {video ? (
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: "Fighter", value: fighter?.name ?? "Unknown fighter" },
                                        { label: "Training type", value: `${TRAINING_TYPE_LABELS[video.trainingType]} · ${CAMERA_ANGLE_LABELS[video.cameraAngle]} camera` },
                                        { label: "File", value: <code className="font-mono text-[13px] break-all">{video.fileName}</code> },
                                        { label: "Size & length", value: `${formatFileSize(video.fileSizeMb)} · ${formatClock(video.durationSec)}` },
                                        { label: "Resolution", value: `${video.resolution.replace("x", "×")} at ${video.fps} fps` },
                                        { label: "Uploaded", value: `${formatDateTime(video.uploadedAt)}${uploader ? ` by ${uploader.name}` : ""}` },
                                    ]}
                                />
                            ) : (
                                <EmptyState compact title="Video removed" description="The footage for this job has been deleted." />
                            )}
                        </CardContent>
                        {video && (
                            <CardFooter>
                                <span className="text-fg-muted">Storage and deletion</span>
                                <Link href={hrefWith(routes.admin.videos, {}, { q: video.fileName })} className="font-medium text-primary-soft-fg hover:underline">
                                    Manage video
                                </Link>
                            </CardFooter>
                        )}
                    </Card>

                    <Card className="overflow-hidden">
                        <CardHeader title="Models used" description={pluralize(models.length, "model")} icon={<BrainCircuit />} />
                        {models.length === 0 ? (
                            <CardContent>
                                <p className="text-sm text-fg-muted">Models are assigned when the job starts.</p>
                            </CardContent>
                        ) : (
                            <ul className="divide-y divide-border border-t border-border">
                                {models.map((model) => (
                                    <li key={model.id} className="px-5 py-3">
                                        <p className="text-xs text-fg-subtle">{AI_MODEL_TASK_LABELS[model.task]}</p>
                                        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                                            <Link href={routes.admin.aiModel(model.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                                {model.name} <span className="font-mono text-[13px] text-fg-muted">{model.version}</span>
                                            </Link>
                                            <ModelStatusBadge status={model.status} size="sm" />
                                        </div>
                                        <p className="mt-0.5 text-xs text-fg-muted">
                                            {model.avgLatencyMs} ms avg latency · review below {formatConfidence(model.lowConfidenceThreshold)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}

function TimeValue({ iso, now }: { iso: string; now: string }) {
    return (
        <time dateTime={iso} title={formatRelative(iso, now)}>
            {formatDateTime(iso)}
        </time>
    );
}
