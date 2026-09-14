import { CalendarCheck2, CalendarPlus, CircleCheck, ClipboardPlus, ListTodo, MessageSquareText, ShieldAlert, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildCoachAttention } from "@/components/dashboard/coach-attention";
import { firstName, greetingFor } from "@/components/dashboard/dashboard-utils";
import { loadRoster, scopedFighterIds } from "@/components/dashboard/roster-data";
import { RosterGlance } from "@/components/dashboard/roster-glance";
import { TeamTrendCard } from "@/components/dashboard/team-trend-card";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { AttentionList } from "@/components/medical/attention-list";
import { HealthBreakdown } from "@/components/medical/health-breakdown";
import { weekStartKey } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { clearanceExpiresSoon } from "@/lib/domain/rules";
import type { HealthStatus } from "@/lib/domain/types";
import { academyDayStartIso, addDaysToKey, dayKey, formatWeekdayDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { getWeeklyVolume } from "@/lib/services/performance";
import { listCoachFeedback, listSessions } from "@/lib/services/training";
import { listReviewQueue } from "@/lib/services/videos";

export const metadata: Metadata = { title: "Coach dashboard" };

const ATTENTION_LIMIT = 8;
const FEEDBACK_LIMIT = 3;
const VOLUME_WEEKS = 8;
const MISSED_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export default async function CoachDashboardPage() {
    const user = await requireRole("coach");
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const today = dayKey(now);
    const todayStart = academyDayStartIso(today);
    const tomorrowStart = academyDayStartIso(addDaysToKey(today, 1));
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const weekEnd = new Date(Date.parse(academyDayStartIso(addDaysToKey(weekKey, 7))) - 1).toISOString();

    const fighterList = listFighters(user);
    const [fighters, roster, weekSessions, reviewQueue, missed, goalsAtRisk, settings, volume, feedback] = await Promise.all([
        fighterList,
        loadRoster(user, now, { fighters: fighterList }),
        listSessions({ fighterIds: scope, from: weekStart, to: weekEnd }),
        listReviewQueue(scope),
        listSessions({ fighterIds: scope, status: "missed", from: new Date(Date.parse(now) - MISSED_WINDOW_DAYS * DAY_MS).toISOString(), to: now, order: "desc" }),
        listGoals({ fighterIds: scope, status: "at_risk" }),
        getSettings(),
        scopedFighterIds(user, fighterList).then((ids) => getWeeklyVolume(ids, VOLUME_WEEKS + 1)),
        user.profileId ? listCoachFeedback({ coachId: user.profileId, fighterIds: scope }) : [],
    ]);

    const todaySessions = weekSessions.filter((session) => session.scheduledAt >= todayStart && session.scheduledAt < tomorrowStart);
    const todayActive = todaySessions.filter((session) => session.status !== "cancelled");
    const todayCompleted = todayActive.filter((session) => session.status === "completed").length;
    const weekPlanned = weekSessions.filter((session) => session.status !== "cancelled");
    const weekCompleted = weekPlanned.filter((session) => session.status === "completed").length;

    const healthCounts: Record<HealthStatus, number> = { healthy: 0, monitoring: 0, injured: 0, recovery: 0, not_cleared: 0 };
    for (const fighter of fighters) healthCounts[fighter.healthStatus] += 1;

    const warningDays = settings.clearanceExpiryWarningDays;
    const notCleared = roster.filter((entry) => entry.clearanceState === "not_cleared" || entry.clearanceState === "expired").length;
    const restricted = roster.filter((entry) => entry.clearanceState === "restricted").length;
    const withoutClearance = roster.filter((entry) => entry.clearanceState === "none").length;
    const expiring = roster.filter((entry) => clearanceExpiresSoon(entry.clearance, warningDays, now));
    const clearanceAlerts = new Set([
        ...roster.filter((entry) => entry.clearanceState !== "full").map((entry) => entry.fighter.id),
        ...expiring.map((entry) => entry.fighter.id),
    ]).size;
    const lowConfidenceAnalyses = reviewQueue.filter((item) => item.lowConfidenceFindings > 0).length;

    const attention = buildCoachAttention({ roster, weekSessions, reviewQueue, missed, goalsAtRisk, warningDays, now });
    const fighterNames = new Map(fighters.map((fighter) => [fighter.id, fighter.name]));
    const scheduleFighters = Object.fromEntries(roster.map((entry) => [entry.fighter.id, { name: entry.fighter.name, clearanceState: entry.clearanceState }]));
    const completeVolume = volume.filter((week) => week.complete).slice(-VOLUME_WEEKS);

    const clearanceHint = [
        notCleared > 0 ? `${notCleared} not cleared` : null,
        withoutClearance > 0 ? `${withoutClearance} without clearance` : null,
        restricted > 0 ? `${restricted} restricted` : null,
        expiring.length > 0 ? `${expiring.length} expiring ≤ ${warningDays} days` : null,
    ].filter(Boolean);

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title={`${greetingFor(now)}, ${firstName(user.name)}`}
                description={`Coach dashboard · ${pluralize(fighters.length, "fighter")} on your roster · ${pluralize(todayActive.length, "session")} today`}
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

            <div className="flex flex-col gap-6">
                <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Roster health" value={fighters.length} unit={fighters.length === 1 ? "fighter" : "fighters"} icon={<Users />} href={routes.coach.fighters}>
                        <HealthBreakdown counts={healthCounts} />
                    </StatCard>
                    <StatCard
                        label="Sessions today"
                        value={todayActive.length}
                        icon={<CalendarCheck2 />}
                        href={routes.coach.sessions}
                        hint={todayActive.length === 0 ? "Nothing scheduled today" : `${todayCompleted} completed · ${todayActive.length - todayCompleted} to go`}
                    >
                        <ProgressBar
                            value={weekCompleted}
                            max={Math.max(1, weekPlanned.length)}
                            size="sm"
                            showLabel
                            label="This week"
                            valueText={`${weekCompleted} of ${weekPlanned.length} completed`}
                        />
                    </StatCard>
                    <StatCard
                        label="Analyses awaiting review"
                        value={reviewQueue.length}
                        icon={<Sparkles />}
                        href={routes.coach.videoAnalysis}
                        hint={
                            reviewQueue.length === 0
                                ? "Every analysis has your review"
                                : lowConfidenceAnalyses > 0
                                  ? `${lowConfidenceAnalyses} with low-confidence findings`
                                  : "No low-confidence findings"
                        }
                    />
                    <StatCard
                        label="Clearance alerts"
                        value={clearanceAlerts}
                        unit={clearanceAlerts === 1 ? "fighter" : "fighters"}
                        icon={<ShieldAlert />}
                        href={routes.coach.clearance}
                        hint={clearanceHint.length > 0 ? clearanceHint.join(" · ") : "Everyone fully cleared"}
                    />
                </section>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 lg:col-span-2">
                        <CardHeader
                            title="Needs attention"
                            description={attention.length > 0 ? `${pluralize(attention.length, "item")}, most urgent first` : "Clearance, sessions, analyses and goals are all in order"}
                            icon={<ListTodo />}
                        />
                        {attention.length > 0 ? (
                            <AttentionList items={attention.slice(0, ATTENTION_LIMIT)} className="border-t border-border" />
                        ) : (
                            <EmptyState
                                compact
                                icon={<CircleCheck />}
                                title="Nothing needs your attention"
                                description="No clearance conflicts, low-confidence findings, missed sessions or goals at risk."
                                className="border-t border-border"
                            />
                        )}
                        {attention.length > ATTENTION_LIMIT && (
                            <CardFooter className="text-fg-muted">
                                <span>
                                    Showing the {ATTENTION_LIMIT} most urgent of {attention.length}.
                                </span>
                                <span className="flex flex-wrap gap-x-3">
                                    <Link href={routes.coach.clearance} className="font-medium text-primary-soft-fg hover:underline">
                                        Clearance
                                    </Link>
                                    <Link href={routes.coach.videoAnalysis} className="font-medium text-primary-soft-fg hover:underline">
                                        Reviews
                                    </Link>
                                    <Link href={routes.coach.goals} className="font-medium text-primary-soft-fg hover:underline">
                                        Goals
                                    </Link>
                                </span>
                            </CardFooter>
                        )}
                    </Card>

                    <TodaySchedule sessions={todaySessions} fighters={scheduleFighters} />
                </div>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <RosterGlance entries={roster} now={now} className="lg:col-span-2" />
                    <TeamTrendCard weeks={completeVolume} href={routes.coach.performance} />
                </div>

                <Card className="min-w-0">
                    <CardHeader title="Your recent feedback" description="What you last told your fighters" icon={<MessageSquareText />} />
                    <CardContent>
                        {feedback.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<MessageSquareText />}
                                title="No feedback yet"
                                description="Feedback you leave on sessions and videos shows up here."
                                className="pt-0"
                            />
                        ) : (
                            <ul className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
                                {feedback.slice(0, FEEDBACK_LIMIT).map((item) => (
                                    <li key={item.id} className="min-w-0">
                                        <p className="mb-2 text-xs text-fg-muted">
                                            To{" "}
                                            <Link href={routes.coach.fighter(item.fighterId)} className="font-medium text-fg hover:underline">
                                                {fighterNames.get(item.fighterId) ?? "fighter"}
                                            </Link>
                                        </p>
                                        <CoachFeedbackItem
                                            feedback={item}
                                            coachName={user.name}
                                            now={now}
                                            sessionHref={item.sessionId ? routes.coach.session(item.sessionId) : undefined}
                                            videoHref={item.videoId ? routes.coach.video(item.videoId) : undefined}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
