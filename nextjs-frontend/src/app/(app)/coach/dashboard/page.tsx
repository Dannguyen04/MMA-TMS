import { CalendarPlus, ClipboardPlus } from "lucide-react";
import type { Metadata } from "next";

import { buildCoachAttention, COACH_QUEUE_META, COACH_QUEUES, type CoachQueue } from "@/components/dashboard/coach-attention";
import { firstName, greetingFor } from "@/components/dashboard/dashboard-utils";
import { QueueCard } from "@/components/dashboard/queue-card";
import { loadRoster } from "@/components/dashboard/roster-data";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { weekStartKey } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { weightAlerts } from "@/lib/domain/weigh-in";
import { academyDayStartIso, addDaysToKey, DAY_MS, dayKey, formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listBouts } from "@/lib/services/bouts";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getNavBadgeCounts } from "@/lib/services/shell";
import { listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";
import { param } from "@/lib/utils";
import { WeightAlertsCard } from "./weight-alerts-card";

export const metadata: Metadata = { title: "Today" };

const MISSED_WINDOW_DAYS = 7;

/**
 * The coach's Today page answers one question: what needs me now? One corner queue, filterable by group, and
 * today's schedule beside it. Roster trends, volume and feedback live in their own hubs.
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
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings, bouts] = await Promise.all([
        fighterList,
        loadRoster(user, now, { fighters: fighterList, performance: false }),
        listSessions({ fighterIds: scope, from: weekStart, to: weekEnd }),
        listReviewQueue(scope),
        listSessions({ fighterIds: scope, status: "missed", from: new Date(Date.parse(now) - MISSED_WINDOW_DAYS * DAY_MS).toISOString(), to: now, order: "desc" }),
        // Without the goals service the Goals group is left out.
        platformFeatureAvailable("goals") ? listGoals({ fighterIds: scope, status: "at_risk" }) : null,
        getSettings(),
        // Same source as the badges on /coach/bouts. Without the bouts service the weight alerts are left out.
        nullIfServiceFails(listBouts({ fighterIds: scope })),
    ]);
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

                <div className="flex min-w-0 flex-col gap-6">
                    <WeightAlertsCard alerts={weightAlerts(bouts ?? [])} fighterNames={new Map(fighters.map((fighter) => [fighter.id, fighter.name]))} t={t} locale={locale} />
                    <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} />
                </div>
            </div>
        </>
    );
}
