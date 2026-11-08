import { Activity, BellOff, BrainCircuit, CircleAlert, CircleX, Clock, Hourglass, KeyRound, ListOrdered, ScrollText, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ADMIN_QUEUES, adminQueueMeta, buildAdminAttention, type AdminQueue } from "@/components/admin/admin-attention";
import { ROLE_ORDER } from "@/components/admin/admin-format";
import { ModelStatusBadge } from "@/components/admin/admin-badges";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { SystemStatus, type AttentionItem as SystemSignal } from "@/components/admin/system-status";
import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { seriesColor } from "@/components/charts/colors";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { CardLink } from "@/components/dashboard/card-link";
import { firstName, greetingKey } from "@/components/dashboard/dashboard-utils";
import { QueueCard } from "@/components/dashboard/queue-card";
import { MetricTile } from "@/components/domain/metric-tile";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { AI_MODEL_TASK_LABELS, PIPELINE_STAGE_LABELS, ROLE_LABELS } from "@/lib/domain/labels";
import type { AIModelTask } from "@/lib/domain/types";
import { formatDateTime, formatNumber, formatPercent, formatRelative, formatShortDate, formatWeekdayDate } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";
import { plural } from "@/lib/i18n/translate";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getAdminOverview, getSettings } from "@/lib/services/admin";
import { adminFeatureAvailable } from "@/lib/services/admin-features";
import { listApplications } from "@/lib/services/admissions";
import { getAIJobStats, listAIJobs, listAIModels, type AIJobListItem } from "@/lib/services/ai";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listAuditLogs } from "@/lib/services/audit";
import { listStaffAccounts } from "@/lib/services/care-team";
import { listCareTeamGaps } from "@/lib/services/care-team-gaps";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

const HOUR_MS = 3_600_000;
const STALLED_AFTER_MS = 30 * 60_000;
const QUEUE_BACKLOG = 5;
const FAILED_SIGN_IN_ALERT = 3;
const RECENT_FAILURE_LIMIT = 3;
const TASKS = Object.keys(AI_MODEL_TASK_LABELS) as AIModelTask[];

/**
 * The administrator's Today page answers one question: who is waiting on me? One queue of the hand-offs only an
 * administrator makes (an assessing coach, a decision, a care team), filterable by group, with the accounts beside
 * it. Platform health follows below: the signals that need an administrator, then the AI pipeline and activity.
 */
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin/dashboard">) {
    const { t } = await getTranslator();
    const admin = await requireRole("admin");
    const query = await searchParams;
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const dayAgo = new Date(nowDate.getTime() - 24 * HOUR_MS).toISOString();
    const showActivity = platformFeatureAvailable("auditLogs");
    const showModels = platformFeatureAvailable("aiModels");

    const [applications, careTeamGaps, coaches, overview, pipeline, models, settings, failedSignIns] = await Promise.all([
        listApplications(),
        listCareTeamGaps(admin),
        listStaffAccounts("coach"),
        getAdminOverview(nowDate),
        // The analysis service is separate: when it doesn't answer, the queue and accounts still show.
        nullIfServiceFails(Promise.all([getAIJobStats(nowDate), listAIJobs()])),
        showModels ? listAIModels() : [],
        getSettings(),
        listAuditLogs({ resourceType: "auth", status: "failure", from: dayAgo }),
    ]);
    const [stats, jobs] = pipeline ?? [null, []];
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? t("adminBody.fallback.coach");

    const attention = buildAdminAttention({ applications, careTeamGaps, coachName, now, t });
    const queue = parseEnum(param(query.queue), ADMIN_QUEUES);

    const processing = jobs.filter(({ job }) => job.status === "processing").sort((a, b) => (a.job.startedAt ?? "").localeCompare(b.job.startedAt ?? ""));
    const queued = jobs.filter(({ job }) => job.status === "queued").sort((a, b) => a.job.queuedAt.localeCompare(b.job.queuedAt));
    const stalled = processing.filter(({ job }) => job.startedAt && nowDate.getTime() - Date.parse(job.startedAt) > STALLED_AFTER_MS);
    // Failures a later run already fixed (the video points at a newer job) need no action, so they're left out.
    const recentFailures = jobs
        .filter(({ job, video }) => job.status === "failed" && video?.jobId === job.id)
        .sort((a, b) => (b.job.finishedAt ?? "").localeCompare(a.job.finishedAt ?? ""))
        .slice(0, RECENT_FAILURE_LIMIT);

    const failed = stats?.last24h.failed ?? 0;
    const totalUsers = ROLE_ORDER.reduce((total, role) => total + overview.usersByRole[role], 0);
    const invitations = adminFeatureAvailable("inviteUsers");
    const jobControl = platformFeatureAvailable("aiJobControl");

    const signals: SystemSignal[] = [];
    if (!stats) {
        signals.push({
            id: "pipeline-unavailable",
            icon: CircleX,
            title: t("adminBody.today.serviceDown"),
            description: t("adminBody.today.serviceDownText"),
            href: routes.admin.aiJobs,
            actionLabel: t("nav.AI jobs"),
        });
    }
    if (failed > 0) {
        signals.push({
            id: "failed-jobs",
            icon: CircleX,
            title: t("adminBody.today.failedJobs", { n: failed }),
            description: t("adminBody.today.failedJobsText"),
            href: hrefWith(routes.admin.aiJobs, {}, { status: "failed" }),
            actionLabel: t("adminBody.today.review"),
        });
    }
    if (stalled.length > 0) {
        signals.push({
            id: "stalled-jobs",
            icon: Hourglass,
            title: plural(t, "adminBody.today.stalledTitle", stalled.length),
            description: jobControl ? t("adminBody.today.stalledControl") : t("adminBody.today.stalledPlain"),
            href: stalled.length === 1 ? routes.admin.aiJob(stalled[0].job.id) : hrefWith(routes.admin.aiJobs, {}, { status: "processing" }),
            actionLabel: t("adminBody.today.inspect"),
        });
    }
    if (queued.length >= QUEUE_BACKLOG) {
        signals.push({
            id: "queue-backlog",
            icon: ListOrdered,
            title: plural(t, "adminBody.today.backlogTitle", queued.length),
            description: t("adminBody.today.backlog"),
            href: hrefWith(routes.admin.aiJobs, {}, { status: "queued" }),
            actionLabel: t("adminBody.today.viewQueue"),
        });
    }
    if (failedSignIns.length >= FAILED_SIGN_IN_ALERT) {
        signals.push({
            id: "failed-sign-ins",
            icon: KeyRound,
            title: plural(t, "adminBody.today.signInsTitle", failedSignIns.length),
            description: t("adminBody.today.signIns"),
            href: hrefWith(routes.admin.auditLogs, {}, { resource: "auth", status: "failure" }),
            actionLabel: t("adminBody.today.auditLog"),
        });
    }
    if (!settings.abnormalMovementAlertsEnabled) {
        signals.push({
            id: "alerts-off",
            icon: BellOff,
            title: t("adminBody.today.alertsOff"),
            description: t("adminBody.today.alertsOffText"),
            href: routes.admin.settings,
            actionLabel: t("nav.Settings"),
        });
    }

    return (
        <div className="workspace-editorial">
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title={admin.name.trim() && admin.name.trim() !== admin.email ? t("greeting.named", { greeting: t(greetingKey(now)), name: firstName(admin.name) }) : t(greetingKey(now))}
                description={`${settings.organizationName} · ${attention.length === 0 ? t("screens.misc.adminPages.today.nothingWaiting") : t("screens.misc.adminPages.today.waiting", { n: attention.length })}`}
                actions={
                    <ButtonLink href={routes.admin.newUser}>
                        <UserPlus aria-hidden />
                        {invitations ? t("screens.misc.adminPages.today.invite") : t("screens.misc.adminPages.today.addUser")}
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                {careTeamGaps === null && (
                    <Callout tone="warning" icon={CircleAlert} title={t("screens.misc.adminPages.today.careTeams")}>
                        {t("screens.misc.adminPages.today.careTeamsBody")}
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <QueueCard
                        title={t("adminBody.today.waitingTitle")}
                        filterLabel={t("adminBody.today.filterQueue")}
                        items={attention}
                        queues={ADMIN_QUEUES}
                        meta={adminQueueMeta(t)}
                        active={queue}
                        hrefFor={(next: AdminQueue | null) => hrefWith(routes.admin.dashboard, query, { queue: next })}
                        emptyAll={{
                            title: t("adminBody.today.nothingTitle"),
                            description: t("adminBody.today.nothingText"),
                        }}
                        className="lg:col-span-2"
                    />

                    <Card className="min-w-0">
                        <CardHeader title={t("adminBody.today.usersByRole")} description={t("adminBody.today.accountsOfStatus", { n: totalUsers })} icon={<Users />} />
                        <CardContent>
                            <HorizontalBars
                                ariaLabel={t("adminBody.today.accountsAria")}
                                items={ROLE_ORDER.map((role) => ({ label: ROLE_LABELS[role], value: overview.usersByRole[role] }))}
                            />
                        </CardContent>
                        <CardFooter>
                            <span className="text-fg-muted">
                                {invitations
                                    ? overview.invitedUsers > 0
                                        ? plural(t, "adminBody.today.invitesPending", overview.invitedUsers)
                                        : t("adminBody.today.noInvites")
                                    : t("adminBody.today.suspended", { n: overview.suspendedUsers })}
                            </span>
                            <Link href={routes.admin.users} className="font-medium text-primary-soft-fg hover:underline">
                                {t("adminBody.users.colUser")}
                            </Link>
                        </CardFooter>
                    </Card>
                </div>

                <SystemStatus items={signals} checkedLabel={formatDateTime(now)} t={t} />

                {!stats ? (
                    <Card>
                        <CardHeader title={t("adminBody.today.pipeline")} icon={<Activity />} action={<CardLink href={routes.admin.aiJobs}>{t("adminBody.today.allJobs")}</CardLink>} />
                        <CardContent>
                            <FeatureUnavailable
                                title={t("adminBody.today.pipelineDown")}
                                description={t("adminBody.today.pipelineDownText")}
                                compact
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                        <Card className="min-w-0 lg:col-span-2">
                            <CardHeader
                                title={t("adminBody.today.pipeline")}
                                description={t("adminBody.today.pipelineDesc")}
                                icon={<Activity />}
                                action={<CardLink href={routes.admin.aiJobs}>{t("adminBody.today.allJobs")}</CardLink>}
                            />
                            <CardContent className="flex flex-col gap-5">
                                <ChartFigure
                                    title={t("adminBody.today.throughput")}
                                    description={t("adminBody.today.throughputDesc")}
                                    table={{
                                        columns: [t("adminBody.today.day"), t("adminBody.today.completed"), t("adminBody.today.failed")],
                                        rows: stats.dailyThroughput.map((day) => [formatShortDate(`${day.date}T12:00:00+07:00`), day.completed, day.failed]),
                                    }}
                                >
                                    <BarChart
                                        ariaLabel={t("adminBody.today.throughputAria")}
                                        labels={stats.dailyThroughput.map((day) => formatShortDate(`${day.date}T12:00:00+07:00`))}
                                        series={[
                                            { id: "completed", label: t("adminBody.today.completed"), color: seriesColor(3), values: stats.dailyThroughput.map((day) => day.completed) },
                                            { id: "failed", label: t("adminBody.today.failed"), color: seriesColor(8), values: stats.dailyThroughput.map((day) => day.failed) },
                                        ]}
                                        stacked
                                        height={250}
                                        yTicks={4}
                                    />
                                </ChartFigure>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <MetricTile label={t("adminBody.today.failureRate")} value={formatPercent(stats.failureRate7d, 1)} hint={t("adminBody.today.ofFinished")} />
                                    <MetricTile
                                        label={t("adminBody.today.lowConfidence")}
                                        value={stats.lowConfidenceRate7d === null ? "—" : formatPercent(stats.lowConfidenceRate7d, 1)}
                                        hint={stats.lowConfidenceRate7d === null ? t("adminBody.today.nothingWaiting") : formatPercent(settings.aiLowConfidenceThreshold * 100)}
                                    />
                                    <MetricTile label={t("adminBody.today.processingNow")} value={formatNumber(processing.length)} hint={stalled.length > 0 ? t("adminBody.today.over30", { n: stalled.length }) : t("adminBody.today.workersBusy")} />
                                    <MetricTile label={t("adminBody.today.queued")} value={formatNumber(queued.length)} hint={queued.length > 0 ? t("adminBody.today.oldest", { when: formatRelative(queued[0].job.queuedAt, now, t.locale === "en" ? "en" : "vi") }) : t("adminBody.today.nothingWaiting")} />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex min-w-0 flex-col gap-6">
                            <JobQueueCard processing={processing} queued={queued} now={now} t={t} />
                            <FailuresCard failures={recentFailures} now={now} canRetry={jobControl} t={t} />
                        </div>
                    </div>
                )}

                {(showActivity || showModels) && (
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                        {showActivity && (
                            <Card className={showModels ? "min-w-0 overflow-hidden lg:col-span-2" : "min-w-0 overflow-hidden lg:col-span-3"}>
                                <CardHeader
                                    title={t("adminBody.today.activity")}
                                    description={t("adminBody.today.activityDesc")}
                                    icon={<ScrollText />}
                                    action={<CardLink href={routes.admin.auditLogs}>{t("adminBody.audit.caption")}</CardLink>}
                                />
                                {overview.recentAudit.length === 0 ? (
                                    <CardContent>
                                        <EmptyState compact title={t("adminBody.today.noActivity")} description={t("adminBody.today.noActivityText")} />
                                    </CardContent>
                                ) : (
                                    <AuditActivityList entries={overview.recentAudit} now={now} className="border-t border-border" />
                                )}
                            </Card>
                        )}

                        {showModels && (
                            <Card className={showActivity ? "min-w-0 overflow-hidden" : "min-w-0 overflow-hidden lg:col-span-3"}>
                                <CardHeader
                                    title={t("adminBody.today.modelStatus")}
                                    description={t("adminBody.today.modelStatusDesc")}
                                    icon={<BrainCircuit />}
                                    action={<CardLink href={routes.admin.aiModels}>{t("adminBody.today.models")}</CardLink>}
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
                                                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-sm text-danger-fg">{t("adminBody.today.noActiveModel")}</p>
                                                        <Link href={routes.admin.aiModels} className="text-[13px] font-medium text-primary-soft-fg hover:underline">
                                                            {t("adminBody.today.promote")}
                                                        </Link>
                                                    </div>
                                                )}
                                                {staging.map((model) => (
                                                    <div key={model.id} className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                                                        <Link href={routes.admin.aiModel(model.id)} className="min-w-0 truncate text-[13px] text-fg-muted hover:text-fg hover:underline">
                                                            {t("adminBody.today.candidate")} <span className="font-mono">{model.version}</span>
                                                        </Link>
                                                        <ModelStatusBadge status="staging" size="sm" />
                                                    </div>
                                                ))}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function jobSubject({ video, fighter, job }: AIJobListItem): string {
    return [video?.title ?? job.videoId, fighter?.name].filter(Boolean).join(" · ");
}

/** The AI analysis queue right now: running jobs with their progress, then the waiting ones in order. */
function JobQueueCard({ processing, queued, now, t }: { processing: AIJobListItem[]; queued: AIJobListItem[]; now: string; t: Translator }) {
    const empty = processing.length === 0 && queued.length === 0;
    const locale = t.locale === "en" ? "en" : "vi";
    return (
        <Card className="overflow-hidden">
            <CardHeader
                title={t("adminBody.today.queue")}
                description={empty ? t("adminBody.today.nothingInFlight") : t("adminBody.today.inFlight", { processing: processing.length, queued: queued.length })}
                icon={<ListOrdered />}
            />
            {empty ? (
                <CardContent>
                    <EmptyState compact icon={<Clock />} title={t("adminBody.today.queueEmpty")} description={t("adminBody.today.queueEmptyText")} />
                </CardContent>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {processing.map((item) => (
                        <li key={item.job.id} className="px-5 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <Link href={routes.admin.aiJob(item.job.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                    {jobSubject(item)}
                                </Link>
                                {item.job.startedAt && <span className="shrink-0 text-xs text-fg-subtle">{t("adminBody.today.started", { when: formatRelative(item.job.startedAt, now, locale) })}</span>}
                            </div>
                            <ProgressBar
                                className="mt-2"
                                size="sm"
                                tone="primary"
                                label={t("adminBody.today.progress", { id: item.job.id })}
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
                                <span className="sr-only">{t("adminBody.today.queuePosition")} </span>
                                {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <Link href={routes.admin.aiJob(item.job.id)} className="block truncate text-sm font-medium text-fg hover:underline">
                                    {jobSubject(item)}
                                </Link>
                                <p className="text-xs text-fg-muted">{t("adminBody.today.queuedWhen", { when: formatRelative(item.job.queuedAt, now, locale) })}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/** `canRetry` when failed jobs can be queued again; otherwise only a new upload fixes them. */
function FailuresCard({ failures, now, canRetry, t }: { failures: AIJobListItem[]; now: string; canRetry: boolean; t: Translator }) {
    const locale = t.locale === "en" ? "en" : "vi";
    const remedy = canRetry ? t("adminBody.today.remedyRetry") : t("adminBody.today.remedyUpload");
    return (
        <Card className="overflow-hidden">
            <CardHeader
                title={t("adminBody.today.failures")}
                description={failures.length === 0 ? t("adminBody.today.noFailures") : t("adminBody.today.needRemedy", { remedy })}
                icon={<CircleX />}
                action={failures.length > 0 ? <CardLink href={hrefWith(routes.admin.aiJobs, {}, { status: "failed" })}>{t("adminBody.today.allFailed")}</CardLink> : undefined}
            />
            {failures.length === 0 ? (
                <CardContent>
                    <EmptyState compact title={t("adminBody.today.noFailures")} description={t("adminBody.today.failuresEmpty", { remedy })} />
                </CardContent>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {failures.map((item) => (
                        <li key={item.job.id} className="flex items-start gap-3 px-5 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-fg">{item.video?.title ?? item.job.videoId}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                                    <code className="rounded bg-danger-soft px-1 font-mono text-[11px] text-danger-fg ring-1 ring-danger-border ring-inset">
                                        {item.job.errorCode ?? t("adminBody.today.unknownCode")}
                                    </code>
                                    <span className="font-mono">{item.job.id}</span>
                                    {item.job.finishedAt && <span>{formatRelative(item.job.finishedAt, now, locale)}</span>}
                                </p>
                            </div>
                            <ButtonLink href={routes.admin.aiJob(item.job.id)} variant="secondary" size="sm">
                                {canRetry ? t("adminBody.today.retry") : t("adminBody.today.inspect")}
                                <span className="sr-only"> {item.job.id}</span>
                            </ButtonLink>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
