import { Activity, BellOff, BrainCircuit, CircleAlert, CircleX, Clock, Hourglass, KeyRound, ListOrdered, ScrollText, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { adminQueueMeta, ADMIN_QUEUES, buildAdminAttention, type AdminQueue } from "@/components/admin/admin-attention";
import { countLabel, modelTaskLabel, pipelineStageLabel, ROLE_ORDER, roleLabel, splitAround } from "@/components/admin/admin-format";
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
import { AI_MODEL_TASK_LABELS } from "@/lib/domain/labels";
import type { AIModelTask } from "@/lib/domain/types";
import { formatDateTime, formatNumber, formatPercent, formatRelative, formatShortDate, formatWeekdayDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
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

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.today") };
}

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
    const admin = await requireRole("admin");
    const { t, locale } = await getTranslator();
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
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? t("role.coach");

    const attention = buildAdminAttention({ applications, careTeamGaps, coachName, now, locale });
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
            title: t("screens.admin.today.signal.unavailable.title"),
            description: t("screens.admin.today.signal.unavailable.description"),
            href: routes.admin.aiJobs,
            actionLabel: t("screens.admin.today.signal.unavailable.action"),
        });
    }
    if (failed > 0) {
        signals.push({
            id: "failed-jobs",
            icon: CircleX,
            title: t("screens.admin.today.signal.failed.title", { jobs: countLabel(t, "screens.admin.count.aiJobs", failed) }),
            description: t("screens.admin.today.signal.failed.description"),
            href: hrefWith(routes.admin.aiJobs, {}, { status: "failed" }),
            actionLabel: t("screens.admin.today.signal.failed.action"),
        });
    }
    if (stalled.length > 0) {
        signals.push({
            id: "stalled-jobs",
            icon: Hourglass,
            title: t("screens.admin.today.signal.stalled.title", { jobs: countLabel(t, "screens.admin.count.jobs", stalled.length) }),
            description: jobControl ? t("screens.admin.today.signal.stalled.descriptionControl") : t("screens.admin.today.signal.stalled.description"),
            href: stalled.length === 1 ? routes.admin.aiJob(stalled[0].job.id) : hrefWith(routes.admin.aiJobs, {}, { status: "processing" }),
            actionLabel: t("screens.admin.today.signal.stalled.action"),
        });
    }
    if (queued.length >= QUEUE_BACKLOG) {
        signals.push({
            id: "queue-backlog",
            icon: ListOrdered,
            title: t("screens.admin.today.signal.backlog.title", { jobs: countLabel(t, "screens.admin.count.jobs", queued.length) }),
            description: t("screens.admin.today.signal.backlog.description"),
            href: hrefWith(routes.admin.aiJobs, {}, { status: "queued" }),
            actionLabel: t("screens.admin.today.signal.backlog.action"),
        });
    }
    if (failedSignIns.length >= FAILED_SIGN_IN_ALERT) {
        signals.push({
            id: "failed-sign-ins",
            icon: KeyRound,
            title: t("screens.admin.today.signal.signIns.title", { attempts: countLabel(t, "screens.admin.count.failedSignIns", failedSignIns.length) }),
            description: t("screens.admin.today.signal.signIns.description"),
            href: hrefWith(routes.admin.auditLogs, {}, { resource: "auth", status: "failure" }),
            actionLabel: t("screens.admin.today.signal.signIns.action"),
        });
    }
    if (!settings.abnormalMovementAlertsEnabled) {
        signals.push({
            id: "alerts-off",
            icon: BellOff,
            title: t("screens.admin.today.signal.alertsOff.title"),
            description: t("screens.admin.today.signal.alertsOff.description"),
            href: routes.admin.settings,
            actionLabel: t("screens.admin.today.signal.alertsOff.action"),
        });
    }

    // "Good morning, Linh", or just the greeting when the account has no name of its own.
    const name = admin.name.trim();
    const greeting = name && name !== admin.email ? t("greeting.named", { greeting: t(greetingKey(now)), name: firstName(name) }) : t(greetingKey(now));
    const dayLabel = (date: string) => formatShortDate(`${date}T12:00:00+07:00`, locale);

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now, locale)}
                title={greeting}
                description={
                    attention.length === 0
                        ? t("screens.admin.today.summaryNothing", { org: settings.organizationName })
                        : t("screens.admin.today.summaryWaiting", { org: settings.organizationName, people: countLabel(t, "screens.admin.count.people", attention.length) })
                }
                actions={
                    <ButtonLink href={routes.admin.newUser}>
                        <UserPlus aria-hidden />
                        {invitations ? t("screens.admin.common.inviteUser") : t("screens.admin.common.addUser")}
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                {careTeamGaps === null && (
                    <Callout tone="warning" icon={CircleAlert} title={t("screens.admin.common.careTeamsUnchecked")}>
                        {t("screens.admin.today.careTeamsUncheckedBody")}
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <QueueCard
                        title={t("screens.admin.today.queueTitle")}
                        filterLabel={t("screens.admin.today.queueFilter")}
                        items={attention}
                        queues={ADMIN_QUEUES}
                        meta={adminQueueMeta(t)}
                        active={queue}
                        hrefFor={(next: AdminQueue | null) => hrefWith(routes.admin.dashboard, query, { queue: next })}
                        emptyAll={{
                            title: t("screens.admin.today.queueEmptyTitle"),
                            description: t("screens.admin.today.queueEmptyDescription"),
                        }}
                        t={t}
                        className="lg:col-span-2"
                    />

                    <Card className="min-w-0">
                        <CardHeader
                            title={t("screens.admin.today.usersByRole")}
                            description={t("screens.admin.today.usersByRoleDescription", { accounts: countLabel(t, "screens.admin.count.accounts", totalUsers) })}
                            icon={<Users />}
                        />
                        <CardContent>
                            <HorizontalBars
                                ariaLabel={t("screens.admin.today.accountsPerRole")}
                                items={ROLE_ORDER.map((role) => ({ label: roleLabel(t, role), value: overview.usersByRole[role] }))}
                            />
                        </CardContent>
                        <CardFooter>
                            <span className="text-fg-muted">
                                {invitations
                                    ? overview.invitedUsers > 0
                                        ? t("screens.admin.today.invitationsPending", { invitations: countLabel(t, "screens.admin.count.invitations", overview.invitedUsers) })
                                        : t("screens.admin.today.noPendingInvitations")
                                    : t("screens.admin.today.suspendedCount", { n: overview.suspendedUsers })}
                            </span>
                            <Link href={routes.admin.users} className="font-medium text-primary-soft-fg hover:underline">
                                {t("screens.admin.today.manageUsers")}
                            </Link>
                        </CardFooter>
                    </Card>
                </div>

                <SystemStatus items={signals} checkedLabel={t("screens.admin.today.checked", { date: formatDateTime(now, locale) })} locale={locale} />

                {!stats ? (
                    <Card>
                        <CardHeader
                            title={t("screens.admin.today.pipelineHealth")}
                            icon={<Activity />}
                            action={<CardLink href={routes.admin.aiJobs}>{t("screens.admin.today.allJobs")}</CardLink>}
                        />
                        <CardContent>
                            <FeatureUnavailable
                                title={t("screens.admin.today.pipelineUnavailableTitle")}
                                description={t("screens.admin.today.pipelineUnavailableDescription")}
                                compact
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                        <Card className="min-w-0 lg:col-span-2">
                            <CardHeader
                                title={t("screens.admin.today.pipelineHealth")}
                                description={t("screens.admin.today.pipelineDescription")}
                                icon={<Activity />}
                                action={<CardLink href={routes.admin.aiJobs}>{t("screens.admin.today.allJobs")}</CardLink>}
                            />
                            <CardContent className="flex flex-col gap-5">
                                <ChartFigure
                                    title={t("screens.admin.today.throughput")}
                                    description={t("screens.admin.today.throughputDescription")}
                                    table={{
                                        columns: [t("screens.admin.today.day"), t("screens.admin.common.completed"), t("screens.admin.common.failed")],
                                        rows: stats.dailyThroughput.map((day) => [dayLabel(day.date), day.completed, day.failed]),
                                    }}
                                >
                                    <BarChart
                                        ariaLabel={t("screens.admin.today.throughputChart")}
                                        labels={stats.dailyThroughput.map((day) => dayLabel(day.date))}
                                        series={[
                                            {
                                                id: "completed",
                                                label: t("screens.admin.common.completed"),
                                                color: seriesColor(3),
                                                values: stats.dailyThroughput.map((day) => day.completed),
                                            },
                                            { id: "failed", label: t("screens.admin.common.failed"), color: seriesColor(8), values: stats.dailyThroughput.map((day) => day.failed) },
                                        ]}
                                        stacked
                                        height={250}
                                        yTicks={4}
                                    />
                                </ChartFigure>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <MetricTile
                                        label={t("screens.admin.today.failureRate7d")}
                                        value={formatPercent(stats.failureRate7d, 1)}
                                        hint={t("screens.admin.today.ofFinishedJobs")}
                                        locale={locale}
                                    />
                                    <MetricTile
                                        label={t("screens.admin.today.lowConfidence7d")}
                                        value={stats.lowConfidenceRate7d === null ? "—" : formatPercent(stats.lowConfidenceRate7d, 1)}
                                        hint={
                                            stats.lowConfidenceRate7d === null
                                                ? t("screens.admin.today.noConfidence")
                                                : t("screens.admin.today.belowReviewLine", { pct: formatPercent(settings.aiLowConfidenceThreshold * 100) })
                                        }
                                        locale={locale}
                                    />
                                    <MetricTile
                                        label={t("screens.admin.today.processingNow")}
                                        value={formatNumber(processing.length)}
                                        hint={stalled.length > 0 ? t("screens.admin.today.overThirty", { n: stalled.length }) : t("screens.admin.today.workersBusy")}
                                        locale={locale}
                                    />
                                    <MetricTile
                                        label={t("screens.admin.common.queued")}
                                        value={formatNumber(queued.length)}
                                        hint={
                                            queued.length > 0
                                                ? t("screens.admin.today.oldest", { when: formatRelative(queued[0].job.queuedAt, now, locale) })
                                                : t("screens.admin.today.nothingWaiting")
                                        }
                                        locale={locale}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex min-w-0 flex-col gap-6">
                            <JobQueueCard processing={processing} queued={queued} now={now} t={t} locale={locale} />
                            <FailuresCard failures={recentFailures} now={now} canRetry={jobControl} t={t} locale={locale} />
                        </div>
                    </div>
                )}

                {(showActivity || showModels) && (
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                        {showActivity && (
                            <Card className={showModels ? "min-w-0 overflow-hidden lg:col-span-2" : "min-w-0 overflow-hidden lg:col-span-3"}>
                                <CardHeader
                                    title={t("screens.admin.today.recentActivity")}
                                    description={t("screens.admin.today.recentActivityDescription")}
                                    icon={<ScrollText />}
                                    action={<CardLink href={routes.admin.auditLogs}>{t("screens.admin.today.auditLogs")}</CardLink>}
                                />
                                {overview.recentAudit.length === 0 ? (
                                    <CardContent>
                                        <EmptyState compact title={t("screens.admin.today.noActivityTitle")} description={t("screens.admin.today.noActivityDescription")} />
                                    </CardContent>
                                ) : (
                                    <AuditActivityList entries={overview.recentAudit} now={now} locale={locale} className="border-t border-border" />
                                )}
                            </Card>
                        )}

                        {showModels && (
                            <Card className={showActivity ? "min-w-0 overflow-hidden" : "min-w-0 overflow-hidden lg:col-span-3"}>
                                <CardHeader
                                    title={t("screens.admin.today.modelStatus")}
                                    description={t("screens.admin.today.modelStatusDescription")}
                                    icon={<BrainCircuit />}
                                    action={<CardLink href={routes.admin.aiModels}>{t("screens.admin.today.models")}</CardLink>}
                                />
                                <ul className="divide-y divide-border border-t border-border">
                                    {TASKS.map((task) => {
                                        const active = models.find((m) => m.task === task && m.status === "active");
                                        const staging = models.filter((m) => m.task === task && m.status === "staging");
                                        return (
                                            <li key={task} className="px-5 py-3">
                                                <p className="text-xs font-medium text-fg-subtle">{modelTaskLabel(t, task)}</p>
                                                {active ? (
                                                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                        <Link href={routes.admin.aiModel(active.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                                            {active.name} <span className="font-mono text-[13px] text-fg-muted">{active.version}</span>
                                                        </Link>
                                                        <ModelStatusBadge status="active" size="sm" locale={locale} />
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-sm text-danger-fg">{t("screens.admin.today.noActiveModel")}</p>
                                                        <Link href={routes.admin.aiModels} className="text-[13px] font-medium text-primary-soft-fg hover:underline">
                                                            {t("screens.admin.today.promoteOne")}
                                                        </Link>
                                                    </div>
                                                )}
                                                {staging.map((model) => (
                                                    <div key={model.id} className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                                                        <Link href={routes.admin.aiModel(model.id)} className="min-w-0 truncate text-[13px] text-fg-muted hover:text-fg hover:underline">
                                                            <Candidate version={model.version} t={t} />
                                                        </Link>
                                                        <ModelStatusBadge status="staging" size="sm" locale={locale} />
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
        </>
    );
}

/** "Candidate v2.1", the version set in mono. */
function Candidate({ version, t }: { version: string; t: Translator }) {
    const [before, after] = splitAround(t("screens.admin.today.candidate"), "version");
    return (
        <>
            {before}
            <span className="font-mono">{version}</span>
            {after}
        </>
    );
}

function jobSubject({ video, fighter, job }: AIJobListItem): string {
    return [video?.title ?? job.videoId, fighter?.name].filter(Boolean).join(" · ");
}

interface LocalisedProps {
    t: Translator;
    locale: Locale;
}

/** The AI analysis queue right now: running jobs with their progress, then the waiting ones in order. */
function JobQueueCard({ processing, queued, now, t, locale }: { processing: AIJobListItem[]; queued: AIJobListItem[]; now: string } & LocalisedProps) {
    const empty = processing.length === 0 && queued.length === 0;
    return (
        <Card className="overflow-hidden">
            <CardHeader
                title={t("screens.admin.today.queue.title")}
                description={empty ? t("screens.admin.today.queue.empty") : t("screens.admin.today.queue.summary", { processing: processing.length, queued: queued.length })}
                icon={<ListOrdered />}
            />
            {empty ? (
                <CardContent>
                    <EmptyState compact icon={<Clock />} title={t("screens.admin.today.queue.emptyTitle")} description={t("screens.admin.today.queue.emptyDescription")} />
                </CardContent>
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {processing.map((item) => (
                        <li key={item.job.id} className="px-5 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <Link href={routes.admin.aiJob(item.job.id)} className="min-w-0 truncate text-sm font-medium text-fg hover:underline">
                                    {jobSubject(item)}
                                </Link>
                                {item.job.startedAt && (
                                    <span className="shrink-0 text-xs text-fg-subtle">
                                        {t("screens.admin.today.queue.started", { when: formatRelative(item.job.startedAt, now, locale) })}
                                    </span>
                                )}
                            </div>
                            <ProgressBar
                                className="mt-2"
                                size="sm"
                                tone="primary"
                                label={t("screens.admin.common.progress", { id: item.job.id })}
                                showLabel={false}
                                hideValue
                                value={item.job.progressPct}
                            />
                            <p className="mt-1.5 flex justify-between gap-2 text-xs text-fg-muted">
                                <span className="truncate">{pipelineStageLabel(t, item.job.stage)}</span>
                                <span className="shrink-0 tabular-nums">{item.job.progressPct}%</span>
                            </p>
                        </li>
                    ))}
                    {queued.map((item, index) => (
                        <li key={item.job.id} className="flex items-center gap-3 px-5 py-3">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold text-fg-muted tabular-nums">
                                <span className="sr-only">{t("screens.admin.today.queue.position")}</span>
                                {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <Link href={routes.admin.aiJob(item.job.id)} className="block truncate text-sm font-medium text-fg hover:underline">
                                    {jobSubject(item)}
                                </Link>
                                <p className="text-xs text-fg-muted">{t("screens.admin.today.queue.queued", { when: formatRelative(item.job.queuedAt, now, locale) })}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/** `canRetry` when failed jobs can be queued again; otherwise only a new upload fixes them. */
function FailuresCard({ failures, now, canRetry, t, locale }: { failures: AIJobListItem[]; now: string; canRetry: boolean } & LocalisedProps) {
    return (
        <Card className="overflow-hidden">
            <CardHeader
                title={t("screens.admin.today.failures.title")}
                description={
                    failures.length === 0
                        ? t("screens.admin.today.failures.none")
                        : canRetry
                          ? t("screens.admin.today.failures.needRetry")
                          : t("screens.admin.today.failures.needUpload")
                }
                icon={<CircleX />}
                action={
                    failures.length > 0 ? (
                        <CardLink href={hrefWith(routes.admin.aiJobs, {}, { status: "failed" })}>{t("screens.admin.today.failures.allFailed")}</CardLink>
                    ) : undefined
                }
            />
            {failures.length === 0 ? (
                <CardContent>
                    <EmptyState
                        compact
                        title={t("screens.admin.today.failures.none")}
                        description={canRetry ? t("screens.admin.today.failures.emptyRetry") : t("screens.admin.today.failures.emptyUpload")}
                    />
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
                                    {item.job.finishedAt && <span>{formatRelative(item.job.finishedAt, now, locale)}</span>}
                                </p>
                            </div>
                            <ButtonLink href={routes.admin.aiJob(item.job.id)} variant="secondary" size="sm">
                                {canRetry ? t("screens.admin.common.retry") : t("screens.admin.common.inspect")}
                                <span className="sr-only"> {item.job.id}</span>
                            </ButtonLink>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
