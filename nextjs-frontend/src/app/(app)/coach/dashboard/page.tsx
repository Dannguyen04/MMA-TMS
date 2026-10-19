import { CalendarPlus, ClipboardPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildCoachAttention, COACH_QUEUE_META, COACH_QUEUES, type CoachQueue } from "@/components/dashboard/coach-attention";
import { firstName, greetingFor } from "@/components/dashboard/dashboard-utils";
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
import { academyDayStartIso, addDaysToKey, DAY_MS, dayKey, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { requirementsDueOn, requirementsDueSoon, requirementsOverdue } from "@/lib/domain/bout-rules";
import { adherenceAlertLine } from "@/lib/domain/nutrition";
import { getSettings } from "@/lib/services/admin";
import { listCampBouts, listWeightAlerts } from "@/lib/services/bouts";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getNavBadgeCounts } from "@/lib/services/shell";
import { listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

const MISSED_WINDOW_DAYS = 7;

/**
 * The coach's Today page answers one question: what needs me now? One corner queue, filterable by group, and
 * today's schedule beside it. Roster trends, volume and feedback live in their own hubs.
 */
export default async function CoachDashboardPage({ searchParams }: PageProps<"/coach/dashboard">) {
    const user = await requireRole("coach");
    const query = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const today = dayKey(now);
    const todayStart = academyDayStartIso(today);
    const tomorrowStart = academyDayStartIso(addDaysToKey(today, 1));
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const weekEnd = new Date(Date.parse(academyDayStartIso(addDaysToKey(weekKey, 7))) - 1).toISOString();

    const fighterList = listFighters(user);
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings, weightAlerts, bouts] = await Promise.all([
        fighterList,
        loadRoster(user, now, { fighters: fighterList, performance: false }),
        listSessions({ fighterIds: scope, from: weekStart, to: weekEnd }),
        listReviewQueue(scope),
        listSessions({ fighterIds: scope, status: "missed", from: new Date(Date.parse(now) - MISSED_WINDOW_DAYS * DAY_MS).toISOString(), to: now, order: "desc" }),
        // Without the goals service the Goals group is left out.
        platformFeatureAvailable("goals") ? listGoals({ fighterIds: scope, status: "at_risk" }) : null,
        getSettings(),
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
        warningDays: settings.clearanceExpiryWarningDays,
        now,
    });
    const queues = COACH_QUEUES.filter((queue) => queue !== "goals" || goalsAtRisk !== null);
    const queue = parseEnum(param(query.queue), queues);

    const todaySessions = weekSessions.filter((session) => session.scheduledAt >= todayStart && session.scheduledAt < tomorrowStart);
    const todayActive = todaySessions.filter((session) => session.status !== "cancelled");
    const scheduleFighters = Object.fromEntries(roster.map((entry) => [entry.fighter.id, { name: entry.fighter.name, clearanceState: entry.clearanceState }]));

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title={`${greetingFor(now)}, ${firstName(user.name)}`}
                description={`${pluralize(fighters.length, "fighter")} in your corner · ${pluralize(todayActive.length, "session")} today`}
                actions={
                    <>
                        <ButtonLink href={routes.coach.newPlan} variant="secondary">
                            <ClipboardPlus aria-hidden />
                            New training plan
                        </ButtonLink>
                        <ButtonLink href={routes.coach.newSession}>
                            <CalendarPlus aria-hidden />
                            Schedule session
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
                    title="Corner queue"
                    filterLabel="Filter the corner queue"
                    items={attention}
                    queues={queues}
                    meta={COACH_QUEUE_META}
                    active={queue}
                    hrefFor={(next: CoachQueue | null) => hrefWith(routes.coach.dashboard, query, { queue: next })}
                    emptyAll={{ title: "Nothing needs your attention", description: "No clearance problems, session clashes, analyses to review or goals at risk." }}
                    className="lg:col-span-2"
                />

                <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} />
            </div>
        </>
    );
}
