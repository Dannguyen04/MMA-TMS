import { CalendarPlus, ClipboardPlus, ListTodo } from "lucide-react";
import type { Metadata } from "next";

import { buildCoachAttention, COACH_QUEUE_META, COACH_QUEUES, type CoachQueue } from "@/components/dashboard/coach-attention";
import { firstName, greetingFor } from "@/components/dashboard/dashboard-utils";
import { loadRoster } from "@/components/dashboard/roster-data";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { AttentionList } from "@/components/medical/attention-list";
import { weekStartKey } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDayStartIso, addDaysToKey, dayKey, formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { nullIfNotFound } from "@/lib/services/api-helpers";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { getNavBadgeCounts } from "@/lib/services/shell";
import { listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

/** The unfiltered queue shows this many; picking a group shows all of it. */
const QUEUE_PREVIEW = 8;
const MISSED_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

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
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings] = await Promise.all([
        fighterList,
        loadRoster(user, now, { fighters: fighterList, performance: false }),
        listSessions({ fighterIds: scope, from: weekStart, to: weekEnd }),
        listReviewQueue(scope),
        listSessions({ fighterIds: scope, status: "missed", from: new Date(Date.parse(now) - MISSED_WINDOW_DAYS * DAY_MS).toISOString(), to: now, order: "desc" }),
        // Goals have no backend endpoint yet: a 404 leaves the Goals group out rather than failing the page.
        nullIfNotFound(listGoals({ fighterIds: scope, status: "at_risk" })),
        getSettings(),
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
    const inQueue = queue ? attention.filter((item) => item.group === queue) : attention;
    const shown = queue ? inQueue : inQueue.slice(0, QUEUE_PREVIEW);

    const todaySessions = weekSessions.filter((session) => session.scheduledAt >= todayStart && session.scheduledAt < tomorrowStart);
    const todayActive = todaySessions.filter((session) => session.status !== "cancelled");
    const scheduleFighters = Object.fromEntries(roster.map((entry) => [entry.fighter.id, { name: entry.fighter.name, clearanceState: entry.clearanceState }]));
    const queueHref = (next: CoachQueue | null) => hrefWith(routes.coach.dashboard, query, { queue: next });

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
                <Card className="min-w-0 lg:col-span-2">
                    <CardHeader
                        title="Corner queue"
                        icon={<ListTodo />}
                        description={attention.length > 0 ? `${pluralize(attention.length, "item")} waiting, most urgent first` : "All clear — nothing needs you right now"}
                    />
                    {attention.length > 0 && (
                        <div className="border-t border-border px-5 py-3">
                            <SegmentedLinks
                                label="Filter the corner queue"
                                items={[
                                    { href: queueHref(null), label: "All", count: attention.length, active: !queue },
                                    ...queues.map((group) => ({
                                        href: queueHref(group),
                                        label: COACH_QUEUE_META[group].label,
                                        icon: COACH_QUEUE_META[group].icon,
                                        count: attention.filter((item) => item.group === group).length,
                                        active: queue === group,
                                    })),
                                ]}
                            />
                        </div>
                    )}
                    <AttentionList
                        items={shown}
                        empty={
                            queue
                                ? COACH_QUEUE_META[queue].empty
                                : { title: "Nothing needs your attention", description: "No clearance problems, session clashes, analyses to review or goals at risk." }
                        }
                        className="border-t border-border"
                    />
                    {!queue && inQueue.length > shown.length && (
                        <CardFooter className="text-fg-muted">
                            Showing the {shown.length} most urgent of {inQueue.length}. Pick a group above to see the rest.
                        </CardFooter>
                    )}
                </Card>

                <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} />
            </div>
        </>
    );
}
