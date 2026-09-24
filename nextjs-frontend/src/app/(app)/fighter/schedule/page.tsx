import { CalendarClock, CalendarDays, ClipboardList, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WeekAgenda } from "@/components/domain/week-agenda";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { ClearanceBanner } from "@/components/training/clearance-banner";
import { getClearanceSummary, getCoachNames } from "@/components/training/training-data";
import { describeWeekOffset, parseWeekOffset, planTimeline, weekStartKey } from "@/components/training/training-utils";
import { UpcomingByDay } from "@/components/training/upcoming-by-day";
import { WeekNav, weekRangeLabel } from "@/components/training/week-nav";
import { WeekSummary } from "@/components/training/week-summary";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDayStartIso, addDaysToKey, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getWeekAgenda, listPlans, listSessions } from "@/lib/services/training";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Schedule" };

const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 14;

export default async function FighterSchedulePage({ searchParams }: PageProps<"/fighter/schedule">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const params = await searchParams;

    const current = new Date();
    const nowMs = current.getTime();
    const now = current.toISOString();
    const offset = parseWeekOffset(param(params.week));
    const startKey = weekStartKey(now, offset);
    const weekStartIso = `${startKey}T12:00:00.000Z`;
    // "Upcoming" never repeats the week on screen: it starts after the visible week, or now when a past week is shown.
    const showsPastWeek = offset < 0;
    const afterWeekIso = academyDayStartIso(addDaysToKey(startKey, 7));
    const upcomingStartMs = showsPastWeek ? nowMs : Date.parse(afterWeekIso);

    const [agenda, later, coachNames, clearance, activePlans] = await Promise.all([
        getWeekAgenda([fighter.id], weekStartIso, 7),
        listSessions({
            fighterIds: [fighter.id],
            status: ["scheduled", "in_progress", "cancelled"],
            // A day back from now catches sessions that are still running.
            from: showsPastWeek ? new Date(nowMs - DAY_MS).toISOString() : afterWeekIso,
            to: new Date(upcomingStartMs + UPCOMING_DAYS * DAY_MS).toISOString(),
        }),
        getCoachNames(),
        getClearanceSummary(fighter.id, now),
        listPlans({ fighterIds: [fighter.id], status: "active" }),
    ]);

    const weekSessions = agenda.flatMap((day) => day.sessions);
    const upcoming = later.filter((s) => Date.parse(s.scheduledAt) + s.durationMin * 60_000 >= nowMs);
    const activePlan = activePlans[0];
    const planProgress = activePlan ? planTimeline(activePlan, now) : null;
    const scheduledCount = weekSessions.filter((s) => s.status !== "cancelled").length;
    const upcomingDescription = offset === 0 ? "Next week and beyond" : offset > 0 ? `After ${weekRangeLabel(startKey)}` : `Next ${UPCOMING_DAYS} days`;

    return (
        <>
            <PageHeader
                title="Schedule"
                description="Your training week and what's coming up. Open a session for drills, targets and coach notes."
                actions={
                    <ButtonLink href={routes.fighter.history} variant="secondary">
                        <History aria-hidden />
                        Training history
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                <ClearanceBanner summary={clearance} href={routes.fighter.health} />

                <Card>
                    <CardHeader
                        title={weekRangeLabel(startKey)}
                        description={`${describeWeekOffset(offset)} · ${pluralize(scheduledCount, "session")}`}
                        icon={<CalendarDays />}
                        action={<WeekNav pathname={routes.fighter.schedule} searchParams={params} offset={offset} startKey={startKey} />}
                        className="flex-wrap"
                    />
                    <CardContent>
                        <WeekAgenda sessions={weekSessions} startDate={weekStartIso} now={now} getHref={(session) => routes.fighter.session(session.id)} />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 overflow-hidden lg:col-span-2">
                        <CardHeader title="Upcoming" description={upcomingDescription} icon={<CalendarClock />} />
                        {upcoming.length === 0 ? (
                            <CardContent>
                                <EmptyState
                                    compact
                                    icon={<CalendarClock />}
                                    title={showsPastWeek ? "Nothing scheduled in the next two weeks" : `Nothing scheduled after ${offset === 0 ? "this" : "that"} week yet`}
                                    description="When your coach schedules sessions they appear here, and you'll get a notification."
                                />
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <UpcomingByDay sessions={upcoming} now={now} audience="fighter" coachNames={coachNames} />
                            </div>
                        )}
                    </Card>

                    <div className="order-first flex min-w-0 flex-col gap-6 lg:order-last">
                        <WeekSummary sessions={weekSessions} description={weekRangeLabel(startKey)} />
                        {activePlan && planProgress && (
                            <Card>
                                <CardHeader title="Current plan" icon={<ClipboardList />} />
                                <CardContent className="flex flex-col gap-3">
                                    <Link href={routes.fighter.plan(activePlan.id)} className="text-sm font-semibold text-fg hover:underline">
                                        {activePlan.title}
                                    </Link>
                                    <ProgressBar
                                        value={planProgress.elapsedPct}
                                        label={`Time elapsed in ${activePlan.title}`}
                                        valueText={planProgress.text}
                                        size="sm"
                                    />
                                    <p className="text-[13px] text-fg-muted">
                                        Target {pluralize(activePlan.weeklySessionTarget, "session")} a week
                                        {coachNames[activePlan.coachId] ? ` · Coach ${coachNames[activePlan.coachId]}` : ""}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
