import {
    Activity,
    BellOff,
    BrainCircuit,
    CircleX,
    Clock,
    Cpu,
    HardDrive,
    Hourglass,
    KeyRound,
    ListOrdered,
    ScrollText,
    Timer,
    UserPlus,
    Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatDurationSec, percentOf, ROLE_ORDER } from "@/components/admin/admin-format";
import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { SystemStatus, type AttentionItem } from "@/components/admin/system-status";
import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { seriesColor } from "@/components/charts/colors";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { CardLink } from "@/components/dashboard/card-link";
import { MetricTile } from "@/components/domain/metric-tile";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { StatCard, type StatDelta } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { AI_MODEL_TASK_LABELS, PIPELINE_STAGE_LABELS, ROLE_LABELS } from "@/lib/domain/labels";
import type { AIModelTask } from "@/lib/domain/types";
import { formatDateTime, formatDelta, formatNumber, formatPercent, formatRelative, formatShortDate, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getAdminOverview, getSettings } from "@/lib/services/admin";
import { getAIJobStats, listAIJobs, listAIModels, type AIJobListItem } from "@/lib/services/ai";
import { listAuditLogs } from "@/lib/services/audit";
import { round } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform overview" };

const HOUR_MS = 3_600_000;
const STALLED_AFTER_MS = 30 * 60_000;
const QUEUE_BACKLOG = 5;
const FAILED_SIGN_IN_ALERT = 3;
const RECENT_FAILURE_LIMIT = 3;
const TASKS = Object.keys(AI_MODEL_TASK_LABELS) as AIModelTask[];

export default async function AdminDashboardPage() {
    await requireRole("admin");
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const dayAgo = new Date(nowDate.getTime() - 24 * HOUR_MS).toISOString();

    const [overview, stats, jobs, models, settings, failedSignIns] = await Promise.all([
        getAdminOverview(nowDate),
        getAIJobStats(nowDate),
        listAIJobs(),
        listAIModels(),
        getSettings(),
        listAuditLogs({ resourceType: "auth", status: "failure", from: dayAgo }),
    ]);

    const processing = jobs.filter(({ job }) => job.status === "processing").sort((a, b) => (a.job.startedAt ?? "").localeCompare(b.job.startedAt ?? ""));
    const queued = jobs.filter(({ job }) => job.status === "queued").sort((a, b) => a.job.queuedAt.localeCompare(b.job.queuedAt));
    const stalled = processing.filter(({ job }) => job.startedAt && nowDate.getTime() - Date.parse(job.startedAt) > STALLED_AFTER_MS);
    // Failures a later run already fixed (the video points at a newer job) need no action, so they're left out.
    const recentFailures = jobs
        .filter(({ job, video }) => job.status === "failed" && video?.jobId === job.id)
        .sort((a, b) => (b.job.finishedAt ?? "").localeCompare(a.job.finishedAt ?? ""))
        .slice(0, RECENT_FAILURE_LIMIT);

    const { completed, failed } = stats.last24h;
    const finished24h = completed + failed;
    const failureRate24h = round(percentOf(failed, finished24h), 1);
    const failureDelta = round(failureRate24h - stats.failureRate7d, 1);
    const failureDeltaStat: StatDelta | undefined =
        finished24h === 0
            ? undefined
            : {
                  value: `${formatDelta(failureDelta, 1)} pts`,
                  direction: failureDelta > 0 ? "up" : failureDelta < 0 ? "down" : "flat",
                  sentiment: failureDelta > 0 ? "bad" : failureDelta < 0 ? "good" : "neutral",
                  label: "failure rate vs 7 d",
              };
    const totalUsers = ROLE_ORDER.reduce((total, role) => total + overview.usersByRole[role], 0);

    const attention: AttentionItem[] = [];
    if (failed > 0) {
        attention.push({
            id: "failed-jobs",
            icon: CircleX,
            title: `${pluralize(failed, "AI job")} failed in the last 24 hours`,
            description: "Check the error codes — some need a retry, others a new upload.",
            href: hrefWith(routes.admin.aiJobs, {}, { status: "failed" }),
            actionLabel: "Review",
        });
    }
    if (stalled.length > 0) {
        attention.push({
            id: "stalled-jobs",
            icon: Hourglass,
            title: `${pluralize(stalled.length, "job")} processing for over 30 minutes`,
            description: "The worker may be stuck. Cancel and retry if progress doesn't move.",
            href: stalled.length === 1 ? routes.admin.aiJob(stalled[0].job.id) : hrefWith(routes.admin.aiJobs, {}, { status: "processing" }),
            actionLabel: "Inspect",
        });
    }
    if (queued.length >= QUEUE_BACKLOG) {
        attention.push({
            id: "queue-backlog",
            icon: ListOrdered,
            title: `${pluralize(queued.length, "job")} waiting in the queue`,
            description: "Uploads will take longer than usual to analyse.",
            href: hrefWith(routes.admin.aiJobs, {}, { status: "queued" }),
            actionLabel: "View queue",
        });
    }
    if (failedSignIns.length >= FAILED_SIGN_IN_ALERT) {
        attention.push({
            id: "failed-sign-ins",
            icon: KeyRound,
            title: `${pluralize(failedSignIns.length, "failed sign-in attempt")} in the last 24 hours`,
            description: "Look for repeated attempts on the same account.",
            href: hrefWith(routes.admin.auditLogs, {}, { resource: "auth", status: "failure" }),
            actionLabel: "Audit log",
        });
    }
    if (!settings.abnormalMovementAlertsEnabled) {
        attention.push({
            id: "alerts-off",
            icon: BellOff,
            title: "AI movement observations are turned off",
            description: "Doctors won't see new possible abnormal movement from analysed footage.",
            href: routes.admin.settings,
            actionLabel: "Settings",
        });
    }

    return (
        <>
            <PageHeader
                eyebrow={settings.organizationName}
                title="Platform overview"
                description="Accounts, the AI analysis pipeline and system activity at a glance."
                actions={
                    <>
                        <ButtonLink href={routes.admin.aiJobs} variant="secondary">
                            <Cpu aria-hidden />
                            AI jobs
                        </ButtonLink>
                        <ButtonLink href={routes.admin.newUser}>
                            <UserPlus aria-hidden />
                            Invite user
                        </ButtonLink>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <SystemStatus items={attention} checkedLabel={`Checked ${formatDateTime(now)}`} />

                <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Active users · 7 days"
                        value={formatNumber(overview.activeUsers7d)}
                        unit={`of ${totalUsers}`}
                        icon={<Users aria-hidden />}
                        hint={`${overview.invitedUsers} invited · ${overview.suspendedUsers} suspended`}
                        href={routes.admin.users}
                    />
                    <StatCard
                        label="AI jobs · last 24 hours"
                        value={formatNumber(completed)}
                        unit="completed"
                        icon={<Cpu aria-hidden />}
                        delta={failureDeltaStat}
                        hint={finished24h === 0 ? "No jobs finished in the last 24 hours" : `${failed} failed · ${formatPercent(failureRate24h, 1)} failure rate`}
                        href={routes.admin.aiJobs}
                    />
                    <StatCard
                        label="Avg processing time · 7 days"
                        value={stats.avgDurationSec7d > 0 ? formatDurationSec(stats.avgDurationSec7d) : "—"}
                        icon={<Timer aria-hidden />}
                        hint={`per completed job · ${processing.length + queued.length} in flight now`}
                    />
                    <StatCard
                        label="Video storage used"
                        value={formatNumber(overview.storageUsedGb, 1)}
                        unit="GB"
                        icon={<HardDrive aria-hidden />}
                        hint={`${pluralize(overview.videosTotal, "video")} · ${settings.videoRetentionDays}-day retention`}
                        href={routes.admin.videos}
                    />
                </section>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 lg:col-span-2">
                        <CardHeader
                            title="AI pipeline health"
                            description="Jobs finished per day over the last 14 days"
                            icon={<Activity />}
                            action={<CardLink href={routes.admin.aiJobs}>All jobs</CardLink>}
                        />
                        <CardContent className="flex flex-col gap-5">
                            <ChartFigure
                                title="Daily throughput"
                                description="Completed and failed jobs, stacked"
                                table={{
                                    columns: ["Day", "Completed", "Failed"],
                                    rows: stats.dailyThroughput.map((day) => [formatShortDate(`${day.date}T12:00:00+07:00`), day.completed, day.failed]),
                                }}
                            >
                                <BarChart
                                    ariaLabel="AI jobs completed and failed per day over the last 14 days"
                                    labels={stats.dailyThroughput.map((day) => formatShortDate(`${day.date}T12:00:00+07:00`))}
                                    series={[
                                        { id: "completed", label: "Completed", color: seriesColor(3), values: stats.dailyThroughput.map((day) => day.completed) },
                                        { id: "failed", label: "Failed", color: seriesColor(8), values: stats.dailyThroughput.map((day) => day.failed) },
                                    ]}
                                    stacked
                                    height={250}
                                    yTicks={4}
                                />
                            </ChartFigure>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <MetricTile label="Failure rate · 7 d" value={formatPercent(stats.failureRate7d, 1)} hint="of finished jobs" />
                                <MetricTile
                                    label="Low confidence · 7 d"
                                    value={formatPercent(stats.lowConfidenceRate7d, 1)}
                                    hint={`below ${formatPercent(settings.aiLowConfidenceThreshold * 100)} review line`}
                                />
                                <MetricTile label="Processing now" value={formatNumber(processing.length)} hint={stalled.length > 0 ? `${stalled.length} over 30 min` : "workers busy"} />
                                <MetricTile label="Queued" value={formatNumber(queued.length)} hint={queued.length > 0 ? `oldest ${formatRelative(queued[0].job.queuedAt, now)}` : "nothing waiting"} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex min-w-0 flex-col gap-6">
                        <QueueCard processing={processing} queued={queued} now={now} />
                        <FailuresCard failures={recentFailures} now={now} />
                    </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 overflow-hidden lg:col-span-2">
                        <CardHeader
                            title="Recent activity"
                            description="Latest entries in the audit log"
                            icon={<ScrollText />}
                            action={<CardLink href={routes.admin.auditLogs}>Audit logs</CardLink>}
                        />
                        {overview.recentAudit.length === 0 ? (
                            <CardContent>
                                <EmptyState compact title="No activity yet" description="Sign-ins, changes and pipeline events will appear here." />
                            </CardContent>
                        ) : (
                            <AuditActivityList entries={overview.recentAudit} now={now} className="border-t border-border" />
                        )}
                    </Card>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title="Users by role" description={`${pluralize(totalUsers, "account")} of every status`} icon={<Users />} />
                            <CardContent>
                                <HorizontalBars
                                    ariaLabel="Accounts per role"
                                    items={ROLE_ORDER.map((role) => ({ label: ROLE_LABELS[role], value: overview.usersByRole[role] }))}
                                />
                            </CardContent>
                            <CardFooter>
                                <span className="text-fg-muted">{overview.invitedUsers > 0 ? `${pluralize(overview.invitedUsers, "invitation")} pending` : "No pending invitations"}</span>
                                <Link href={routes.admin.users} className="font-medium text-primary-soft-fg hover:underline">
                                    Manage users
                                </Link>
                            </CardFooter>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader
                                title="Model status"
                                description="Active model per task"
                                icon={<BrainCircuit />}
                                action={<CardLink href={routes.admin.aiModels}>Models</CardLink>}
                            />
                            <ul className="divide-y divide-border border-t border-border">
                                {TASKS.map((task) => {
                                    const active = models.find((m) => m.task === task && m.status === "active");
                                    const staging = models.filter((m) => m.task === task && m.status === "staging");
                                    return (
                                        <li key={task} className="px-5 py-3">
                                            <p className="text-xs font-medium text-fg-subtle">{AI_MODEL_TASK_LABELS[task]}</p>
                                            {active ? (
                                                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                    <Link href={routes.admin.aiModel(active.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                                        {active.name} <span className="font-mono text-[13px] text-fg-muted">{active.version}</span>
                                                    </Link>
                                                    <ModelStatusBadge status="active" size="sm" />
                                                </div>
                                            ) : (
                                                <p className="mt-1 text-sm text-danger-fg">No active model</p>
                                            )}
                                            {staging.map((model) => (
                                                <div key={model.id} className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                                                    <Link href={routes.admin.aiModel(model.id)} className="min-w-0 truncate text-[13px] text-fg-muted hover:text-fg hover:underline">
                                                        Candidate <span className="font-mono">{model.version}</span>
                                                    </Link>
                                                    <ModelStatusBadge status="staging" size="sm" />
                                                </div>
                                            ))}
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}

function jobSubject({ video, fighter, job }: AIJobListItem): string {
    return [video?.title ?? job.videoId, fighter?.name].filter(Boolean).join(" · ");
}

function QueueCard({ processing, queued, now }: { processing: AIJobListItem[]; queued: AIJobListItem[]; now: string }) {
    const empty = processing.length === 0 && queued.length === 0;
    return (
        <Card className="overflow-hidden">
            <CardHeader
                title="Current queue"
                description={empty ? "Nothing in flight" : `${processing.length} processing · ${queued.length} queued`}
                icon={<ListOrdered />}
            />
            {empty ? (
                <CardContent>
                    <EmptyState compact icon={<Clock />} title="Queue is empty" description="New uploads start processing within seconds." />
                </CardContent>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {processing.map((item) => (
                        <li key={item.job.id} className="px-5 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <Link href={routes.admin.aiJob(item.job.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                    {jobSubject(item)}
                                </Link>
                                {item.job.startedAt && <span className="shrink-0 text-xs text-fg-subtle">started {formatRelative(item.job.startedAt, now)}</span>}
                            </div>
                            <ProgressBar
                                className="mt-2"
                                size="sm"
                                tone="primary"
                                label={`${item.job.id} progress`}
                                showLabel={false}
                                hideValue
                                value={item.job.progressPct}
                            />
                            <p className="mt-1.5 flex justify-between gap-2 text-xs text-fg-muted">
                                <span className="truncate">{PIPELINE_STAGE_LABELS[item.job.stage]}</span>
                                <span className="shrink-0 tabular-nums">{item.job.progressPct}%</span>
                            </p>
                        </li>
                    ))}
                    {queued.map((item, index) => (
                        <li key={item.job.id} className="flex items-center gap-3 px-5 py-3">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold text-fg-muted tabular-nums">
                                <span className="sr-only">Queue position </span>
                                {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <Link href={routes.admin.aiJob(item.job.id)} className="block truncate text-sm font-medium text-fg hover:underline">
                                    {jobSubject(item)}
                                </Link>
                                <p className="text-xs text-fg-muted">Queued {formatRelative(item.job.queuedAt, now)}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

function FailuresCard({ failures, now }: { failures: AIJobListItem[]; now: string }) {
    return (
        <Card className="overflow-hidden">
            <CardHeader
                title="Recent failures"
                description={failures.length === 0 ? "No unresolved failures" : "Need a retry or a new upload"}
                icon={<CircleX />}
                action={failures.length > 0 ? <CardLink href={hrefWith(routes.admin.aiJobs, {}, { status: "failed" })}>All failed</CardLink> : undefined}
            />
            {failures.length === 0 ? (
                <CardContent>
                    <EmptyState compact title="No unresolved failures" description="Failed jobs that still need a retry or a new upload appear here with their error code." />
                </CardContent>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {failures.map((item) => (
                        <li key={item.job.id} className="flex items-start gap-3 px-5 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-fg">{item.video?.title ?? item.job.videoId}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                                    <code className="rounded bg-danger-soft px-1 font-mono text-[11px] text-danger-fg ring-1 ring-danger-border ring-inset">
                                        {item.job.errorCode ?? "UNKNOWN"}
                                    </code>
                                    <span className="font-mono">{item.job.id}</span>
                                    {item.job.finishedAt && <span>{formatRelative(item.job.finishedAt, now)}</span>}
                                </p>
                            </div>
                            <ButtonLink href={routes.admin.aiJob(item.job.id)} variant="secondary" size="sm">
                                Retry<span className="sr-only"> {item.job.id}</span>
                            </ButtonLink>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
