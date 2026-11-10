import { CalendarDays, ShieldCheck, Swords } from "lucide-react";
import type { Metadata } from "next";

import { buildCoachAttention, coachQueueMeta, COACH_QUEUES, type CoachQueue } from "@/components/dashboard/coach-attention";
import { firstName, greetingKey } from "@/components/dashboard/dashboard-utils";
import { QueueCard } from "@/components/dashboard/queue-card";
import { loadRoster } from "@/components/dashboard/roster-data";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { weekStartKey } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDateOf } from "@/lib/domain/suspension-rules";
import { academyDayStartIso, addDaysToKey, DAY_MS, dayKey, formatShortDate, formatWeekdayDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getCoachTodo, listCampBouts } from "@/lib/services/bouts";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getNavBadgeCounts } from "@/lib/services/shell";
import { listSuspensions } from "@/lib/services/suspensions";
import { listPlans, listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";
import { param } from "@/lib/utils";
import { CoachHero } from "./coach-hero";
import { activeSuspensionLines, CoachTodoCard } from "./coach-todo-card";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("nav.Today") };
}

const MISSED_WINDOW_DAYS = 7;

/**
 * The coach's Today page answers one question: what needs me now? The camp hero (nearest weigh-in, camp figures) leads;
 * bout tasks and active suspensions sit above the corner queue, today's schedule beside them, and the week below.
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
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings, plans, suspensions, todo, bouts] = await Promise.all([
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
        nullIfServiceFails(listSuspensions(scope === "all" ? {} : { fighterIds: scope }, user)),
        nullIfServiceFails(getCoachTodo(scope)),
        nullIfServiceFails(listCampBouts(scope)),
    ]);

    const fighterNames = new Map(fighters.map((fighter) => [fighter.id, fighter.name]));
    const suspensionLines = activeSuspensionLines(suspensions ?? [], academyDateOf(now));
    const suspendedIds = new Set(suspensionLines.map((line) => line.fighterId));

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
    const scheduleFighters = Object.fromEntries(
        roster.map(({ fighter, clearanceState }) => [
            fighter.id,
            { name: fighter.name, clearanceState, ...(suspendedIds.has(fighter.id) ? { suspensionState: "ACTIVE" as const } : {}) },
        ]),
    );

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
                        <ButtonLink href={routes.coach.readiness} variant="secondary" className="min-h-11">
                            <ShieldCheck aria-hidden />
                            {t("coachToday.readiness")}
                        </ButtonLink>
                        <ButtonLink href={routes.coach.newBout} className="min-h-11">
                            <Swords aria-hidden />
                            {t("coachToday.newBout")}
                        </ButtonLink>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <CoachHero
                    bouts={bouts}
                    suspensions={suspensionLines}
                    roster={roster}
                    todaySessions={todaySessions}
                    fighterNames={fighterNames}
                    now={now}
                    t={t}
                    locale={locale}
                />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <CoachTodoCard todo={todo} suspensions={suspensionLines} fighterNames={fighterNames} t={t} locale={locale} />
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
                        />
                    </div>

                    <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} t={t} locale={locale} />
                </div>

                <Card className="min-w-0">
                    <CardHeader
                        title={t("fighterToday.weekTitle")}
                        description={t("fighterToday.weekDescription", {
                            start: formatShortDate(weekStart, locale),
                            end: formatShortDate(addDaysToKey(weekKey, 6), locale),
                            sessions: plural(t, "coachToday.sessions", weekSessions.filter((session) => session.status !== "cancelled").length),
                        })}
                        icon={<CalendarDays />}
                    />
                    <CardContent>
                        <WeekAgenda
                            sessions={weekSessions}
                            startDate={weekStart}
                            now={now}
                            getHref={(session) => routes.coach.session(session.id)}
                            fightersById={Object.fromEntries(roster.map(({ fighter }) => [fighter.id, fighter]))}
                            locale={locale}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
