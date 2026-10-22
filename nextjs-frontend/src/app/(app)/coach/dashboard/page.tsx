import { CalendarPlus, ClipboardPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildCoachAttention, coachQueueMeta, COACH_QUEUES, type CoachQueue } from "@/components/dashboard/coach-attention";
import { firstName, greetingKey } from "@/components/dashboard/dashboard-utils";
import { QueueCard } from "@/components/dashboard/queue-card";
import { loadRoster } from "@/components/dashboard/roster-data";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { weekStartKey } from "@/components/training/training-utils";
import { CardLink } from "@/components/dashboard/card-link";
import { Gate1Badge, WeightStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDayStartIso, addDaysToKey, DAY_MS, dayKey, formatShortDate, formatWeekdayDate } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { requirementsDueOn, requirementsDueSoon, requirementsOverdue } from "@/lib/domain/bout-rules";
import { adherenceAlertLine } from "@/lib/domain/nutrition";
import { getSettings } from "@/lib/services/admin";
import { listCampBouts, listWeightAlerts } from "@/lib/services/bouts";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getNavBadgeCounts } from "@/lib/services/shell";
import { listPlans, listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("nav.Today") };
}

const MISSED_WINDOW_DAYS = 7;

/**
 * The coach's Today page answers one question: what needs me now? One corner queue, filterable by group, and
 * today's schedule beside it. The queue also carries the coach's hand-off of fighters cleared to train who still need
 * a plan; bouts that need a look sit above it. Roster trends, volume and feedback live in their own hubs.
 */
export default async function CoachDashboardPage({ searchParams }: PageProps<"/coach/dashboard">) {
    const user = await requireRole("coach");
    const [query, { t, locale }] = await Promise.all([searchParams, getTranslator()]);
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const today = dayKey(now);
    const todayStart = academyDayStartIso(today);
    const tomorrowStart = academyDayStartIso(addDaysToKey(today, 1));
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const weekEnd = new Date(Date.parse(academyDayStartIso(addDaysToKey(weekKey, 7))) - 1).toISOString();

    const fighterList = listFighters(user);
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings, plans, weightAlerts, bouts] = await Promise.all([
        fighterList,
        loadRoster(user, now, { fighters: fighterList, performance: false }),
        listSessions({ fighterIds: scope, from: weekStart, to: weekEnd }),
        listReviewQueue(scope),
        listSessions({ fighterIds: scope, status: "missed", from: new Date(Date.parse(now) - MISSED_WINDOW_DAYS * DAY_MS).toISOString(), to: now, order: "desc" }),
        // Without the goals service the Goals group is left out.
        platformFeatureAvailable("goals") ? listGoals({ fighterIds: scope, status: "at_risk" }) : null,
        getSettings(),
        // Every status, so a fighter whose only plan is a draft is told to finish it rather than start another.
        listPlans({ fighterIds: scope }),
        listWeightAlerts(scope, new Date(now)),
        listCampBouts(scope),
    ]);
    // F4: from 14 days before the documents deadline, bouts with required documents still missing.
    const documentsDue = bouts
        .map((bout) => ({ bout, missing: requirementsDueSoon(bout, today) }))
        .filter((row) => row.missing.length > 0)
        .sort((a, b) => (requirementsDueOn(a.bout) < requirementsDueOn(b.bout) ? -1 : 1));
    const fighterNames = new Map(fighters.map((fighter) => [fighter.id, fighter.name]));
    // Without a per-analysis queue (API mode), the navigation's review count still says how many are waiting.
    const reviewCount = reviewQueue.length === 0 ? ((await getNavBadgeCounts(user)).reviewQueue ?? 0) : 0;

    const attention = buildCoachAttention({
        roster,
        weekSessions,
        reviewQueue,
        reviewCount,
        missed,
        goalsAtRisk: goalsAtRisk ?? [],
        plans,
        warningDays: settings.clearanceExpiryWarningDays,
        now,
        t,
        locale,
    });
    // Admissions are frozen (T-001, context 19/10): coaches no longer assess applicants, so that group stays out.
    const queues = COACH_QUEUES.filter((queue) => queue !== "applicants" && (queue !== "goals" || goalsAtRisk !== null));
    const queue = parseEnum(param(query.queue), queues);

    const todaySessions = weekSessions.filter((session) => session.scheduledAt >= todayStart && session.scheduledAt < tomorrowStart);
    const todayActive = todaySessions.filter((session) => session.status !== "cancelled");
    const scheduleFighters = Object.fromEntries(roster.map((entry) => [entry.fighter.id, { name: entry.fighter.name, clearanceState: entry.clearanceState }]));

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now, locale)}
                title={t("greeting.named", { greeting: t(greetingKey(now)), name: firstName(user.name) })}
                description={t("coachToday.description", {
                    fighters: plural(t, "coachToday.fighters", fighters.length),
                    sessions: plural(t, "coachToday.sessions", todayActive.length),
                })}
                actions={
                    <>
                        <ButtonLink href={routes.coach.newPlan} variant="secondary">
                            <ClipboardPlus aria-hidden />
                            {t("coachToday.newPlan")}
                        </ButtonLink>
                        <ButtonLink href={routes.coach.newSession}>
                            <CalendarPlus aria-hidden />
                            {t("coachToday.scheduleSession")}
                        </ButtonLink>
                    </>
                }
            />

            {(weightAlerts.length > 0 || documentsDue.length > 0) && (
                <div className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                    {weightAlerts.length > 0 && (
                        <Card className="min-w-0">
                            <CardHeader title="Weight alerts" description="Running bouts that need a look, red first." action={<CardLink href={routes.coach.bouts}>All bouts</CardLink>} />
                            <CardContent>
                                <ul className="divide-y divide-border">
                                    {weightAlerts.map((alert) => (
                                        <li key={alert.bout.id}>
                                            <Link href={routes.coach.bout(alert.bout.id)} className="flex min-h-11 items-center justify-between gap-3 py-3">
                                                <span className="min-w-0">
                                                    <span className="block font-medium text-fg">{alert.fighterName}</span>
                                                    <span className="block truncate text-sm text-fg-muted">{alert.bout.event}</span>
                                                    {alert.wayOff > 0 && (alert.track.status === "RED" || alert.track.status === "YELLOW") && (
                                                        <span className="block text-sm text-fg-muted">{adherenceAlertLine(alert.wayOff)}</span>
                                                    )}
                                                </span>
                                                <WeightStatusBadge status={alert.track.status} />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {documentsDue.length > 0 && (
                        <Card className="min-w-0">
                            <CardHeader
                                title="Documents due"
                                description="Required documents still missing within 14 days of the deadline."
                                action={weightAlerts.length === 0 ? <CardLink href={routes.coach.bouts}>All bouts</CardLink> : undefined}
                            />
                            <CardContent>
                                <ul className="divide-y divide-border">
                                    {documentsDue.map(({ bout, missing }) => (
                                        <li key={bout.id}>
                                            <Link href={routes.coach.bout(bout.id)} className="flex min-h-11 items-center justify-between gap-3 py-3">
                                                <span className="min-w-0">
                                                    <span className="block font-medium text-fg">{fighterNames.get(bout.fighterId) ?? "Fighter"}</span>
                                                    <span className="block truncate text-sm text-fg-muted">
                                                        {bout.event} · due {formatShortDate(academyDayStartIso(requirementsDueOn(bout)))}
                                                    </span>
                                                    <span className="block text-sm text-fg-muted">{missing.map((gap) => gap.requirement.label).join(", ")}</span>
                                                </span>
                                                <Gate1Badge missing={missing.length} overdue={requirementsOverdue(bout, today)} />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <QueueCard
                    title={t("coachToday.queueTitle")}
                    filterLabel={t("coachToday.queueFilter")}
                    items={attention}
                    queues={queues}
                    meta={coachQueueMeta(t)}
                    active={queue}
                    hrefFor={(next: CoachQueue | null) => hrefWith(routes.coach.dashboard, query, { queue: next })}
                    emptyAll={{ title: t("coachToday.emptyTitle"), description: t("coachToday.emptyText") }}
                    t={t}
                    className="lg:col-span-2"
                />

                <div className="flex min-w-0 flex-col gap-6">
                    <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} t={t} locale={locale} />
                </div>
            </div>
        </>
    );
}
