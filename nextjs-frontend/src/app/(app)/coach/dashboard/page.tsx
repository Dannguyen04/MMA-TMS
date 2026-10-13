import { CalendarPlus, ClipboardPlus } from "lucide-react";
import type { Metadata } from "next";

import { buildCoachAttention, COACH_QUEUE_META, COACH_QUEUES, type CoachQueue } from "@/components/dashboard/coach-attention";
import { greetingTitle } from "@/components/dashboard/dashboard-utils";
import { QueueCard } from "@/components/dashboard/queue-card";
import { loadRoster } from "@/components/dashboard/roster-data";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { weekStartKey } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDayStartIso, addDaysToKey, DAY_MS, dayKey, formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { listAssignedApplications } from "@/lib/services/admissions";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getNavBadgeCounts } from "@/lib/services/shell";
import { listPlans, listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

const MISSED_WINDOW_DAYS = 7;

/**
 * The coach's Today page answers one question: what needs me now? One corner queue, filterable by group, and
 * today's schedule beside it. The queue also carries the coach's hand-offs: applicants waiting for their entrance
 * assessment and fighters cleared to train who still need a plan. Roster trends, volume and feedback live in their
 * own hubs.
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
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings, plans, applicants] = await Promise.all([
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
        listAssignedApplications(user),
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
        plans,
        applicants,
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
                title={greetingTitle(now, user)}
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
                    emptyAll={{
                        title: "Nothing needs your attention",
                        description: "No clearance problems or session clashes, every cleared fighter has a plan, and no analyses or applicants are waiting for you.",
                    }}
                    className="lg:col-span-2"
                />

                <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} />
            </div>
        </>
    );
}
