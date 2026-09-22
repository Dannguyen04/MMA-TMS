import { CalendarCheck2, CalendarDays, ClipboardList, Clock, Gauge, MessageSquareText, ShieldAlert, ShieldQuestion, Target, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CHART_SERIES } from "@/components/charts/colors";
import { Sparkline } from "@/components/charts/sparkline";
import { CardLink } from "@/components/dashboard/card-link";
import { completeWeeks, firstName, greetingFor } from "@/components/dashboard/dashboard-utils";
import { ExaminationSummaryCard } from "@/components/dashboard/examination-summary-card";
import { FightCampCard, type FightCampPlan } from "@/components/dashboard/fight-camp-card";
import { InlineNote } from "@/components/dashboard/inline-note";
import { LatestAnalysesCard } from "@/components/dashboard/latest-analyses-card";
import { NextSessionCard } from "@/components/dashboard/next-session-card";
import { OnboardingCard, type OnboardingStep } from "@/components/dashboard/onboarding-card";
import { RecentSessionsCard } from "@/components/dashboard/recent-sessions-card";
import { TechniqueRadarCard } from "@/components/dashboard/technique-radar-card";
import { TrainingPausedCard } from "@/components/dashboard/training-paused-card";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { GoalCard } from "@/components/domain/goal-card";
import { HealthSummaryCard } from "@/components/domain/health-summary-card";
import { PlanCard } from "@/components/domain/plan-card";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { scoreDelta } from "@/components/performance/performance-format";
import { weekStartKey } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { TRAINING_PHASE_LABELS } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import { planAdherence } from "@/lib/domain/training-plan";
import type { TrainingPlan, UpcomingBout } from "@/lib/domain/types";
import { academyDayStartIso, addDaysToKey, dayKey, daysBetween, formatMinutes, formatNumber, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listGoals } from "@/lib/services/goals";
import { getFighterHealthSummary } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { getPerformanceHistory, getPerformanceSummary, overallScore } from "@/lib/services/performance";
import {
    getPlanWithSessions,
    getSessionHistory,
    getTrainingProgress,
    getUpcomingSessions,
    listCoachFeedback,
    listPlans,
    listSessions,
} from "@/lib/services/training";
import { listVideoLibrary, type VideoLibraryItem } from "@/lib/services/videos";

export const metadata: Metadata = { title: "Dashboard" };

const ANALYSES_LIMIT = 4;
const RECENT_SESSIONS_LIMIT = 3;
const FEEDBACK_LIMIT = 3;
const GOALS_LIMIT = 3;
const TREND_WEEKS = 8;
/** Fighters who joined this recently see the getting-started checklist until every step is done. */
const NEW_FIGHTER_DAYS = 30;

export default async function FighterDashboardPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const ids = [fighter.id];

    const now = new Date().toISOString();
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const nextWeekStart = academyDayStartIso(addDaysToKey(weekKey, 7));

    // The active plan's sessions chain onto the plan list, so they don't wait for the rest of the batch.
    const plansRead = listPlans({ fighterIds: ids });
    const [health, upcoming, recentSessions, weekSessions, progress, summary, history, plans, planDetail, videos, feedback, goals, coaches, doctors] = await Promise.all([
        getFighterHealthSummary(fighter.id, now),
        getUpcomingSessions(ids, 1),
        getSessionHistory(fighter.id),
        listSessions({ fighterIds: ids, from: weekStart, to: new Date(Date.parse(nextWeekStart) - 1).toISOString() }),
        getTrainingProgress(fighter.id, 2),
        getPerformanceSummary(fighter.id),
        getPerformanceHistory(fighter.id, 12),
        plansRead,
        plansRead.then((list) => {
            const active = list.find((plan) => plan.status === "active");
            return active ? getPlanWithSessions(active.id) : null;
        }),
        listVideoLibrary({ fighterIds: ids }),
        listCoachFeedback({ fighterIds: ids }),
        listGoals({ fighterIds: ids }),
        listCoaches(),
        listDoctors(),
    ]);
    if (!health) notFound();

    const activePlan = planDetail?.plan ?? null;
    const adherence = planDetail ? planAdherence(planDetail.sessions, now) : null;

    const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]));
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const { clearance, clearanceState } = health;
    const paused = clearanceState === "not_cleared" || clearanceState === "expired";
    const nextSession = upcoming[0] ?? null;

    const bout = fighter.upcomingBout;
    // A fight-camp plan preparing the booked bout is shown inside the fight camp card rather than as its own plan card.
    const campPlan: FightCampPlan | undefined =
        activePlan && isCampFor(activePlan, bout) ? { plan: activePlan, href: routes.fighter.plan(activePlan.id), adherence } : undefined;
    const phaseText = activePlan ? `${TRAINING_PHASE_LABELS[activePlan.phase]} phase` : "No active training plan";
    const boutText = bout ? `${bout.event} in ${pluralize(Math.max(0, daysBetween(now, bout.date)), "day")}` : "No bout scheduled";

    const trendWeeks = completeWeeks(history, now).slice(-TREND_WEEKS);
    const overallSeries = trendWeeks.map((week) => overallScore(week.scores));
    const thisWeek = progress.at(-1);
    const lastWeek = progress.length > 1 ? progress[0] : null;
    const planned = thisWeek?.plannedSessions ?? 0;
    const completed = thisWeek?.completedSessions ?? 0;
    const openGoals = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = openGoals.filter((goal) => goal.status === "at_risk").length;
    const cancelledThisWeek = weekSessions.filter((session) => session.status === "cancelled").length;
    const plannedThisWeek = weekSessions.filter((session) => session.status !== "cancelled").length;

    const followUpDoctor = health.nextFollowUp ? doctorNames.get(health.nextFollowUp.examination.doctorId) : undefined;
    const clearanceDoctor = clearance ? doctorNames.get(clearance.doctorId) : undefined;

    const onboarding =
        daysBetween(fighter.joinedAt, now) <= NEW_FIGHTER_DAYS
            ? onboardingSteps({ clearanceState, videos, plans, activePlan, goalCount: goals.length })
            : [];
    const showOnboarding = onboarding.some((step) => !step.done);

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title={`${greetingFor(now)}, ${firstName(fighter.name)}`}
                description={`${phaseText} · ${boutText}`}
                actions={
                    <>
                        <ButtonLink href={routes.fighter.schedule} variant="secondary">
                            <CalendarDays aria-hidden />
                            View schedule
                        </ButtonLink>
                        <ButtonLink href={routes.fighter.uploadVideo}>
                            <Upload aria-hidden />
                            Upload video
                        </ButtonLink>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                {showOnboarding && <OnboardingCard steps={onboarding} />}

                <section aria-label="Today at a glance" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {paused ? (
                        <TrainingPausedCard
                            reason={clearanceState === "expired" ? "expired" : "not_cleared"}
                            doctorName={followUpDoctor ?? clearanceDoctor}
                            followUpDate={health.nextFollowUp?.date ?? null}
                            recovery={
                                health.activeRecoveryPlan
                                    ? { phaseName: health.activeRecoveryPlan.currentPhase?.name ?? null, progressPct: health.activeRecoveryPlan.progressPct }
                                    : null
                            }
                            cancelledThisWeek={cancelledThisWeek}
                            healthHref={routes.fighter.health}
                            now={now}
                        />
                    ) : (
                        <NextSessionCard
                            session={nextSession}
                            coachName={nextSession ? coachNames.get(nextSession.coachId) : undefined}
                            sessionHref={nextSession ? routes.fighter.session(nextSession.id) : null}
                            scheduleHref={routes.fighter.schedule}
                            now={now}
                            note={
                                nextSession && clearanceState === "none" ? (
                                    <InlineNote icon={ShieldQuestion} tone="warning">
                                        No Medical Clearance on file yet. Your sports doctor issues it after your baseline physical.
                                    </InlineNote>
                                ) : nextSession && clearanceState === "restricted" ? (
                                    <InlineNote icon={ShieldAlert} tone="info">
                                        You&apos;re cleared with restrictions — your coach plans every session within them.
                                    </InlineNote>
                                ) : undefined
                            }
                        />
                    )}
                    <FightCampCard
                        bout={bout}
                        weightKg={fighter.weightKg}
                        weightClass={fighter.weightClass}
                        campStart={activePlan?.phase === "fight_camp" ? activePlan.startDate : null}
                        campPlan={campPlan}
                        now={now}
                    />
                    <div className="flex min-w-0 flex-col gap-6">
                        <HealthSummaryCard
                            healthStatus={fighter.healthStatus}
                            clearanceState={clearanceState}
                            restrictionsCount={clearanceState === "restricted" ? (clearance?.restrictions.length ?? 0) : 0}
                            nextFollowUpDate={health.nextFollowUp?.date ?? null}
                            now={now}
                            href={routes.fighter.health}
                            className="flex-1"
                        />
                        <ExaminationSummaryCard
                            compact
                            examination={health.latestExamination}
                            doctorName={health.latestExamination ? doctorNames.get(health.latestExamination.doctorId) : undefined}
                            historyHref={routes.fighter.medicalHistory}
                            now={now}
                        />
                    </div>
                </section>

                <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Overall performance"
                        value={summary ? formatNumber(summary.overall, 1) : "—"}
                        unit={summary ? "/ 100" : undefined}
                        icon={<Gauge />}
                        delta={summary ? scoreDelta(summary.overallDelta, summary.comparisonWeeks) : undefined}
                        hint={!summary ? "Appears after your first analysed week" : summary.comparisonWeeks === 0 ? "No earlier week to compare yet" : undefined}
                        href={routes.fighter.performance}
                    >
                        {overallSeries.length >= 2 && (
                            <Sparkline
                                values={overallSeries}
                                color={CHART_SERIES[0]}
                                width={136}
                                ariaLabel={`Overall score over the last ${overallSeries.length} complete weeks, from ${formatNumber(overallSeries[0], 1)} to ${formatNumber(overallSeries[overallSeries.length - 1], 1)}`}
                            />
                        )}
                    </StatCard>
                    <StatCard
                        label="Sessions this week"
                        value={completed}
                        unit={`of ${planned}`}
                        icon={<CalendarCheck2 />}
                        hint={planned === 0 ? (paused ? "Training paused" : "Nothing planned yet") : completed >= planned ? "All done — great week" : `${planned - completed} still to go`}
                        href={routes.fighter.schedule}
                    >
                        {planned > 0 && (
                            <ProgressBar value={completed} max={planned} size="sm" hideValue label="Sessions completed this week" valueText={`${completed} of ${planned}`} />
                        )}
                    </StatCard>
                    <StatCard
                        label="Training minutes this week"
                        value={formatNumber(thisWeek?.trainingMinutes ?? 0)}
                        unit="min"
                        icon={<Clock />}
                        hint={lastWeek ? `Last week: ${formatMinutes(lastWeek.trainingMinutes)}` : undefined}
                        href={routes.fighter.history}
                    />
                    <StatCard
                        label="Goals on track"
                        value={openGoals.length - atRisk}
                        unit={`of ${openGoals.length}`}
                        icon={<Target />}
                        hint={openGoals.length === 0 ? "No open goals right now" : atRisk > 0 ? `${atRisk} at risk — talk it through with your coach` : "Every open goal is on track"}
                        href={routes.fighter.goals}
                    />
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    <TechniqueRadarCard weeks={trendWeeks} summary={summary} href={routes.fighter.performance} className="lg:col-span-2" />
                    <LatestAnalysesCard
                        items={videos.slice(0, ANALYSES_LIMIT)}
                        videoHref={routes.fighter.video}
                        libraryHref={routes.fighter.videos}
                        uploadHref={routes.fighter.uploadVideo}
                        now={now}
                        className="lg:col-span-3"
                    />
                </div>

                <Card className="min-w-0">
                    <CardHeader
                        title="This week"
                        description={`${formatShortDate(weekStart)} – ${formatShortDate(addDaysToKey(weekKey, 6))} · ${
                            paused && plannedThisWeek === 0 ? "training paused" : pluralize(plannedThisWeek, "session")
                        }`}
                        icon={<CalendarDays />}
                        action={<CardLink href={routes.fighter.schedule}>Full schedule</CardLink>}
                    />
                    <CardContent>
                        <WeekAgenda sessions={weekSessions} startDate={weekStart} now={now} getHref={(session) => routes.fighter.session(session.id)} />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 lg:col-span-2">
                        <CardHeader title="Coach feedback" description="The latest notes from your coaches" icon={<MessageSquareText />} />
                        <CardContent>
                            {feedback.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<MessageSquareText />}
                                    title="No feedback yet"
                                    description="Your coaches' notes on sessions and videos will appear here."
                                />
                            ) : (
                                <ul className="flex flex-col divide-y divide-border">
                                    {feedback.slice(0, FEEDBACK_LIMIT).map((item) => (
                                        <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                            <CoachFeedbackItem
                                                feedback={item}
                                                coachName={coachNames.get(item.coachId) ?? "Coach"}
                                                now={now}
                                                sessionHref={item.sessionId ? routes.fighter.session(item.sessionId) : undefined}
                                                videoHref={item.videoId ? routes.fighter.video(item.videoId) : undefined}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex min-w-0 flex-col gap-6">
                        {activePlan ? (
                            !campPlan && (
                                <PlanCard
                                    plan={activePlan}
                                    now={now}
                                    coachName={coachNames.get(activePlan.coachId)}
                                    adherencePct={adherence?.pct}
                                    href={routes.fighter.plan(activePlan.id)}
                                    headingLevel={2}
                                />
                            )
                        ) : (
                            <Card>
                                <CardHeader title="Training plan" icon={<ClipboardList />} />
                                <CardContent>
                                    <EmptyState
                                        compact
                                        title="No active training plan"
                                        description="Your coach shares your plan here once it's ready. Until then, follow your scheduled sessions."
                                        className="pt-0"
                                    />
                                </CardContent>
                            </Card>
                        )}
                        <RecentSessionsCard
                            sessions={recentSessions.filter((session) => session.status !== "cancelled").slice(0, RECENT_SESSIONS_LIMIT)}
                            sessionHref={routes.fighter.session}
                            historyHref={routes.fighter.history}
                            now={now}
                        />
                    </div>
                </div>

                <section aria-labelledby="goals-heading" className="flex min-w-0 flex-col gap-3">
                    <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <h2 id="goals-heading" className="text-[15px] leading-6 font-semibold text-fg">
                                Goals
                            </h2>
                            <p className="text-sm text-fg-muted">
                                {openGoals.length === 0
                                    ? "Goals you set with your coach appear here."
                                    : atRisk > 0
                                      ? `${pluralize(atRisk, "goal")} at risk · ${openGoals.length - atRisk} on track`
                                      : `All ${pluralize(openGoals.length, "open goal")} on track`}
                            </p>
                        </div>
                        <CardLink href={routes.fighter.goals}>All goals</CardLink>
                    </div>
                    {openGoals.length === 0 ? (
                        <EmptyState
                            compact
                            icon={<Target />}
                            title="No open goals"
                            description="Agree a measurable goal with your coach — progress checkpoints show up here."
                            className="rounded-xl border border-dashed border-border-strong"
                        />
                    ) : (
                        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
                            {openGoals.slice(0, GOALS_LIMIT).map((goal) => (
                                <GoalCard key={goal.id} goal={goal} now={now} className="min-w-0" />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}

/** Whether a plan is the fight camp for the booked bout: a fight-camp plan whose window includes fight night. */
function isCampFor(plan: TrainingPlan, bout: UpcomingBout | null): boolean {
    if (!bout || plan.phase !== "fight_camp") return false;
    const fightDay = dayKey(bout.date);
    return dayKey(plan.startDate) <= fightDay && fightDay <= dayKey(plan.endDate);
}

interface OnboardingInput {
    clearanceState: ClearanceState;
    videos: VideoLibraryItem[];
    plans: TrainingPlan[];
    activePlan: TrainingPlan | null;
    goalCount: number;
}

/** Getting-started steps for a new fighter, each done or still to do. */
function onboardingSteps({ clearanceState, videos, plans, activePlan, goalCount }: OnboardingInput): OnboardingStep[] {
    const analysed = videos.some((item) => item.video.status === "completed");
    const failedUpload = videos.some((item) => item.video.status === "failed");
    const draftPlan = plans.some((plan) => plan.status === "draft");
    return [
        {
            id: "medical",
            title: "Baseline medical",
            done: clearanceState !== "none",
            description:
                clearanceState !== "none"
                    ? "Your Medical Clearance is on file."
                    : "Your sports doctor issues your Medical Clearance after a baseline physical. Until then, sessions can't be checked against medical guidance.",
            href: routes.fighter.health,
            actionLabel: "View health",
        },
        {
            id: "video",
            title: "First analysed video",
            done: analysed,
            description: analysed
                ? "The AI has mapped your technique — your coach reviews the findings."
                : failedUpload
                  ? "Your first upload didn't finish processing. Try another clip with your whole body in frame."
                  : "Film a short shadow boxing or pad round so the AI can map your technique.",
            href: routes.fighter.uploadVideo,
            actionLabel: "Upload video",
        },
        {
            id: "plan",
            title: "Training plan",
            done: activePlan !== null,
            description: activePlan
                ? `${activePlan.title} is active.`
                : draftPlan
                  ? "Your coach is preparing your first plan. It shows up here once it's active."
                  : "Your coach builds a plan around your goals and schedule.",
            href: routes.fighter.schedule,
            actionLabel: "View schedule",
        },
        {
            id: "goals",
            title: "First goal",
            done: goalCount > 0,
            description: goalCount > 0 ? `You have ${pluralize(goalCount, "goal")} with your coach.` : "Agree a first measurable goal with your coach.",
            href: routes.fighter.goals,
            actionLabel: "View goals",
        },
    ];
}
