import { CalendarDays, ShieldAlert, ShieldQuestion, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { CornerFeed } from "@/components/dashboard/corner-feed";
import { cornerFeedItems } from "@/components/dashboard/corner-feed-items";
import { firstName, greetingFor, weightCheck, weightGapText } from "@/components/dashboard/dashboard-utils";
import { FightHero, type NextUp } from "@/components/dashboard/fight-hero";
import { InlineNote } from "@/components/dashboard/inline-note";
import { OnboardingStrip, type OnboardingStep } from "@/components/dashboard/onboarding-strip";
import { ReadinessCell, ReadinessNumber, ReadinessStrip } from "@/components/dashboard/readiness-strip";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { weekStartKey } from "@/components/training/training-utils";
import { BeltProgress } from "@/components/ui/belt-progress";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { NOT_RECORDED } from "@/components/domain/domain-format";
import { HEALTH_STATUS_DESCRIPTIONS, WEIGHT_CLASS_LABELS, WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import { planAdherence } from "@/lib/domain/training-plan";
import type { MedicalClearance, TrainingPlan, UpcomingBout } from "@/lib/domain/types";
import { academyDayStartIso, addDaysToKey, dayKey, daysBetween, formatNumber, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listGoals } from "@/lib/services/goals";
import { getFighterHealthSummary } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { getPlanWithSessions, getUpcomingSessions, listCoachFeedback, listPlans, listSessions } from "@/lib/services/training";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listVideoLibrary, type VideoLibraryItem } from "@/lib/services/videos";

export const metadata: Metadata = { title: "Today" };

/** Fighters who joined this recently see the getting-started checklist until every step is done. */
const NEW_FIGHTER_DAYS = 30;
/** Belt stripes stand for the share of open goals on track. */
const GOAL_STRIPES = 4;

/**
 * The fighter's Today page answers one question: what do I do now? The fight camp and next session lead,
 * one strip carries readiness, then this week and the latest from the corner. Everything else lives in its hub.
 */
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
    const [health, upcoming, weekSessions, plans, planDetail, videos, feedback, goals, coaches, doctors] = await Promise.all([
        getFighterHealthSummary(fighter.id, now),
        getUpcomingSessions(ids, 1),
        listSessions({ fighterIds: ids, from: weekStart, to: new Date(Date.parse(nextWeekStart) - 1).toISOString() }),
        plansRead,
        plansRead.then((list) => {
            const active = list.find((plan) => plan.status === "active");
            return active ? getPlanWithSessions(active.id) : null;
        }),
        // Video analysis is a separate service: when it doesn't answer, the day's training still shows.
        nullIfServiceFails(listVideoLibrary({ fighterIds: ids })).then((items) => items ?? []),
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
    const followUpDoctor = health.nextFollowUp ? doctorNames.get(health.nextFollowUp.examination.doctorId) : undefined;
    const clearanceDoctor = clearance ? doctorNames.get(clearance.doctorId) : undefined;

    const next: NextUp = paused
        ? {
              kind: "paused",
              reason: clearanceState === "expired" ? "expired" : "not_cleared",
              doctorName: followUpDoctor ?? clearanceDoctor,
              followUpDate: health.nextFollowUp?.date ?? null,
              healthHref: routes.fighter.health,
          }
        : nextSession
          ? {
                kind: "session",
                session: nextSession,
                coachName: nextSession.coachId ? coachNames.get(nextSession.coachId) : undefined,
                href: routes.fighter.session(nextSession.id),
                note:
                    clearanceState === "none" ? (
                        <InlineNote icon={ShieldQuestion} tone="warning">
                            No Medical Clearance on file yet. Your sports doctor issues it after your baseline physical.
                        </InlineNote>
                    ) : clearanceState === "restricted" ? (
                        <InlineNote icon={ShieldAlert} tone="info">
                            You&apos;re cleared with restrictions — your coach plans every session within them.
                        </InlineNote>
                    ) : undefined,
            }
          : { kind: "none", scheduleHref: routes.fighter.schedule };

    // This week, counted from the same academy week the agenda shows.
    const weekPlanned = weekSessions.filter((session) => session.status !== "cancelled");
    const weekCompleted = weekPlanned.filter((session) => session.status === "completed").length;
    const weekMissed = weekPlanned.filter((session) => session.status === "missed").length;
    const weekToGo = weekPlanned.filter((session) => session.status === "scheduled" || session.status === "in_progress").length;

    const weightClass = bout?.weightClass ?? fighter.weightClass;
    const weight = fighter.weightKg === null ? null : weightCheck(fighter.weightKg, weightClass, bout ? Math.max(0, daysBetween(now, bout.date)) : null);
    const weightLimit = `${WEIGHT_CLASS_LABELS[weightClass]} ${formatNumber(WEIGHT_CLASS_LIMIT_KG[weightClass], 1)} kg`;

    const goalsAvailable = platformFeatureAvailable("goals");
    const openGoals = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = openGoals.filter((goal) => goal.status === "at_risk").length;
    const onTrack = openGoals.length - atRisk;

    const onboarding =
        daysBetween(fighter.joinedAt, now) <= NEW_FIGHTER_DAYS
            ? onboardingSteps({ clearanceState, videos, plans, activePlan, goalCount: goalsAvailable ? goals.length : null })
            : [];

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title={`${greetingFor(now)}, ${firstName(fighter.name)}`}
                actions={
                    <ButtonLink href={routes.fighter.uploadVideo} variant="secondary">
                        <Upload aria-hidden />
                        Upload video
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                <FightHero
                    bout={bout}
                    campStart={activePlan && isCampFor(activePlan, bout) ? activePlan.startDate : null}
                    plan={
                        activePlan
                            ? { title: activePlan.title, href: routes.fighter.plan(activePlan.id), phase: activePlan.phase, adherencePct: adherence?.pct ?? null }
                            : null
                    }
                    next={next}
                    now={now}
                />

                {onboarding.some((step) => !step.done) && <OnboardingStrip steps={onboarding} />}

                <ReadinessStrip label="Readiness">
                    <ReadinessCell
                        label="Medical Clearance"
                        value={<ClearanceBadge state={clearanceState} />}
                        hint={clearanceHint(clearanceState, clearance)}
                        href={routes.fighter.health}
                        className="col-span-2 sm:col-span-2 lg:col-span-1"
                    />
                    <ReadinessCell
                        label="Health"
                        value={<HealthStatusBadge status={fighter.healthStatus} />}
                        hint={
                            health.nextFollowUp
                                ? `Follow-up ${formatShortDate(health.nextFollowUp.date)}${followUpDoctor ? ` · ${followUpDoctor}` : ""}`
                                : HEALTH_STATUS_DESCRIPTIONS[fighter.healthStatus]
                        }
                        href={routes.fighter.health}
                        className="sm:col-span-2 lg:col-span-1"
                    />
                    <ReadinessCell
                        label="Weight"
                        value={
                            weight ? (
                                <ReadinessNumber value={formatNumber(weight.currentKg, 1)} unit="kg" />
                            ) : (
                                <span className="text-sm font-medium text-fg-muted">{NOT_RECORDED}</span>
                            )
                        }
                        hint={weight ? `${weightGapText(weight)} · ${weightLimit}` : `${weightLimit} limit`}
                        href={routes.profile}
                        className="sm:col-span-2 lg:col-span-1"
                    />
                    <ReadinessCell
                        label="This week"
                        value={<ReadinessNumber value={weekCompleted} unit={`of ${weekPlanned.length} done`} />}
                        hint={weekHint({ planned: weekPlanned.length, toGo: weekToGo, missed: weekMissed, paused })}
                        href={routes.fighter.schedule}
                        className="sm:col-span-3 lg:col-span-1"
                    >
                        {weekPlanned.length > 0 && (
                            <ProgressBar
                                value={weekCompleted}
                                max={weekPlanned.length}
                                size="sm"
                                hideValue
                                label="Sessions completed this week"
                                valueText={`${weekCompleted} of ${weekPlanned.length}`}
                            />
                        )}
                    </ReadinessCell>
                    <ReadinessCell
                        label="Goals"
                        value={
                            openGoals.length > 0 ? (
                                <ReadinessNumber value={onTrack} unit={`of ${openGoals.length} on track`} />
                            ) : (
                                <span className="text-sm font-medium text-fg-muted">{goalsAvailable ? "No open goals" : "Not available yet"}</span>
                            )
                        }
                        hint={
                            !goalsAvailable
                                ? "Goals arrive in a later release"
                                : openGoals.length === 0
                                  ? "Agree one with your coach"
                                  : atRisk > 0
                                    ? `${pluralize(atRisk, "goal")} at risk`
                                    : "Every open goal is on track"
                        }
                        href={routes.fighter.goals}
                        className="sm:col-span-3 lg:col-span-1"
                    >
                        {openGoals.length > 0 && (
                            <BeltProgress
                                stripes={(onTrack / openGoals.length) * GOAL_STRIPES}
                                max={GOAL_STRIPES}
                                label={`${onTrack} of ${openGoals.length} open goals on track`}
                            />
                        )}
                    </ReadinessCell>
                </ReadinessStrip>

                <Card className="min-w-0">
                    <CardHeader
                        title="This week"
                        description={`${formatShortDate(weekStart)} – ${formatShortDate(addDaysToKey(weekKey, 6))} · ${
                            paused && weekPlanned.length === 0 ? "training paused" : pluralize(weekPlanned.length, "session")
                        }`}
                        icon={<CalendarDays />}
                        action={<CardLink href={routes.fighter.schedule}>Full schedule</CardLink>}
                    />
                    <CardContent>
                        <WeekAgenda sessions={weekSessions} startDate={weekStart} now={now} getHref={(session) => routes.fighter.session(session.id)} />
                    </CardContent>
                </Card>

                <CornerFeed
                    items={cornerFeedItems(feedback, videos)}
                    coachNames={coachNames}
                    sessionHref={routes.fighter.session}
                    videoHref={routes.fighter.video}
                    filmHref={routes.fighter.videos}
                    uploadHref={routes.fighter.uploadVideo}
                    now={now}
                />
            </div>
        </>
    );
}

function clearanceHint(state: ClearanceState, clearance: MedicalClearance | null): string {
    switch (state) {
        case "full":
            return clearance?.validUntil ? `Valid until ${formatShortDate(clearance.validUntil)}` : "Cleared for full training";
        case "restricted":
            return `${pluralize(clearance?.restrictions.length ?? 0, "restriction")} · your coach plans around them`;
        case "none":
            return "Issued after your baseline physical";
        case "expired":
            return "Needs renewing before you train";
        case "not_cleared":
            return "Training paused by your doctor";
    }
}

function weekHint({ planned, toGo, missed, paused }: { planned: number; toGo: number; missed: number; paused: boolean }): string {
    if (planned === 0) return paused ? "Training paused" : "Nothing planned yet";
    const parts = [toGo > 0 ? `${toGo} still to go` : null, missed > 0 ? `${missed} missed` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "All done — great week";
}

/** Whether a plan is the fight camp for the booked bout: a fight-camp plan whose window includes fight night. */
function isCampFor(plan: TrainingPlan, bout: UpcomingBout | null): boolean {
    if (!bout || plan.phase !== "fight_camp") return false;
    const fightDay = dayKey(bout.date);
    return dayKey(plan.startDate) <= fightDay && (plan.endDate === null || fightDay <= dayKey(plan.endDate));
}

interface OnboardingInput {
    clearanceState: ClearanceState;
    videos: VideoLibraryItem[];
    plans: TrainingPlan[];
    activePlan: TrainingPlan | null;
    /** Null while goals aren't available, which leaves their step out. */
    goalCount: number | null;
}

/** Getting-started steps for a new fighter, each done or still to do. */
function onboardingSteps({ clearanceState, videos, plans, activePlan, goalCount }: OnboardingInput): OnboardingStep[] {
    const analysed = videos.some((item) => item.video.status === "completed");
    const failedUpload = videos.some((item) => item.video.status === "failed");
    const draftPlan = plans.some((plan) => plan.status === "draft");
    const steps: OnboardingStep[] = [
        {
            id: "medical",
            title: "Baseline medical",
            done: clearanceState !== "none",
            description:
                clearanceState !== "none"
                    ? "Your Medical Clearance is on file."
                    : "An administrator assigns your sports doctor, who records your baseline examination and issues your Medical Clearance. Training starts after that.",
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
    ];
    if (goalCount === null) return steps;
    return [
        ...steps,
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
