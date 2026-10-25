import { getDemoCopy, getLocale } from "@/lib/i18n/server";
import { CalendarClock, CalendarDays, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanTimelineBar } from "@/components/domain/plan-schedule";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { ClearanceBanner } from "@/components/training/clearance-banner";
import { getClearanceSummary, getCoachNames } from "@/components/training/training-data";
import { describeWeekOffset, parseWeekOffset, plannedEndMs, weekStartKey } from "@/components/training/training-utils";
import { UpcomingByDay } from "@/components/training/upcoming-by-day";
import { WeekNav, weekRangeLabel } from "@/components/training/week-nav";
import { WeekSummary } from "@/components/training/week-summary";
import { requireFighterId } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDayStartIso, addDaysToKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getWeekAgenda, listPlans, listSessions } from "@/lib/services/training";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> { const copy = await getDemoCopy(); return { title: copy("Schedule") }; }

const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 14;

export default async function FighterSchedulePage({ searchParams }: PageProps<"/fighter/schedule">) {
    const copy = await getDemoCopy();
    const locale = await getLocale();
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
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
        getWeekAgenda([fighterId], weekStartIso, 7),
        listSessions({
            fighterIds: [fighterId],
            status: ["scheduled", "in_progress", "cancelled"],
            // A day back from now catches sessions that are still running.
            from: showsPastWeek ? new Date(nowMs - DAY_MS).toISOString() : afterWeekIso,
            to: new Date(upcomingStartMs + UPCOMING_DAYS * DAY_MS).toISOString(),
        }),
        getCoachNames(),
        getClearanceSummary(fighterId, now),
        listPlans({ fighterIds: [fighterId], status: "active" }),
    ]);

    const weekSessions = agenda.flatMap((day) => day.sessions);
    const upcoming = later.filter((s) => plannedEndMs(s) >= nowMs);
    const activePlan = activePlans[0];
    const scheduledCount = weekSessions.filter((s) => s.status !== "cancelled").length;
    const upcomingDescription = offset === 0 ? copy("Next week and beyond") : offset > 0 ? copy("After {date}", { date: weekRangeLabel(startKey, locale) }) : copy("Next {n} days", { n: UPCOMING_DAYS });

    return (
        <>
            <PageHeader
                title={copy("Schedule")}
                description={copy("Your training week and what's coming up. Open a session for drills, targets and coach notes.")}
            />

            <div className="flex flex-col gap-6">
                <ClearanceBanner locale={locale} summary={clearance} href={routes.fighter.health} />

                <Card>
                    <CardHeader
                        title={weekRangeLabel(startKey, locale)}
                        description={`${describeWeekOffset(offset, locale)} · ${copy("{n} sessions", { n: scheduledCount })}`}
                        icon={<CalendarDays />}
                        action={<WeekNav locale={locale} pathname={routes.fighter.schedule} searchParams={params} offset={offset} startKey={startKey} />}
                        className="flex-wrap"
                    />
                    <CardContent>
                        <WeekAgenda locale={locale} sessions={weekSessions} startDate={weekStartIso} now={now} getHref={(session) => routes.fighter.session(session.id)} />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 overflow-hidden lg:col-span-2">
                        <CardHeader title={copy("Upcoming")} description={upcomingDescription} icon={<CalendarClock />} />
                        {upcoming.length === 0 ? (
                            <CardContent>
                                <EmptyState
                                    compact
                                    icon={<CalendarClock />}
                                    title={showsPastWeek ? copy("Nothing scheduled in the next two weeks") : copy(offset === 0 ? "Nothing scheduled after this week yet" : "Nothing scheduled after that week yet")}
                                    description={copy("When your coach schedules sessions they appear here, and you'll get a notification.")}
                                />
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <UpcomingByDay locale={locale} sessions={upcoming} now={now} audience="fighter" coachNames={coachNames} />
                            </div>
                        )}
                    </Card>

                    <div className="order-first flex min-w-0 flex-col gap-6 lg:order-last">
                        <WeekSummary locale={locale} sessions={weekSessions} description={weekRangeLabel(startKey, locale)} />
                        {activePlan && (
                            <Card>
                                <CardHeader title={copy("Current plan")} icon={<ClipboardList />} />
                                <CardContent className="flex flex-col gap-3">
                                    <Link href={routes.fighter.plan(activePlan.id)} className="text-sm font-semibold text-fg hover:underline">
                                        {activePlan.title}
                                    </Link>
                                    <PlanTimelineBar plan={activePlan} now={now} size="sm" />
                                    <p className="text-[13px] text-fg-muted">
                                        {[
                                            activePlan.weeklySessionTarget === null ? null : copy("Target {n} sessions a week", { n: activePlan.weeklySessionTarget }),
                                            coachNames[activePlan.coachId] ? copy("Coach {name}", { name: coachNames[activePlan.coachId] }) : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
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
