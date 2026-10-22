import { CalendarDays, ShieldAlert, ShieldQuestion, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { CornerFeed } from "@/components/dashboard/corner-feed";
import { cornerFeedItems } from "@/components/dashboard/corner-feed-items";
import { firstName, greetingKey, weightCheck, weightGapText } from "@/components/dashboard/dashboard-utils";
import { FightHero, type HeroBout, type NextUp } from "@/components/dashboard/fight-hero";
import { InlineNote } from "@/components/dashboard/inline-note";
import { OnboardingStrip, type OnboardingStep } from "@/components/dashboard/onboarding-strip";
import { FlashToast } from "@/components/medical/flash-toast";
import { ReadinessCell, ReadinessNumber, ReadinessStrip } from "@/components/dashboard/readiness-strip";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { weekStartKey } from "@/components/training/training-utils";
import { BeltProgress } from "@/components/ui/belt-progress";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireFighterAccess, requireFighterId } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { NOT_RECORDED } from "@/components/domain/domain-format";
import { WEIGHT_CLASS_LABELS, WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import { planAdherence } from "@/lib/domain/training-plan";
import type { MedicalClearance, TrainingPlan } from "@/lib/domain/types";
import { activeBout, WEIGHT_SAVED_NOTICE } from "@/lib/domain/weigh-in";
import { academyDayStartIso, addDaysToKey, dayKey, daysBetween, formatNumber, formatShortDate, formatWeekdayDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listBouts } from "@/lib/services/bouts";
import { listGoals } from "@/lib/services/goals";
import { getFighterHealthSummary } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { getPlanWithSessions, getUpcomingSessions, listCoachFeedback, listPlans, listSessions } from "@/lib/services/training";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { listVideoLibrary, type VideoLibraryItem } from "@/lib/services/videos";
import { param } from "@/lib/utils";
import { BoutWeightCell } from "./bout-weight-cell";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("nav.Today") };
}

/** Fighters who joined this recently see the getting-started checklist until every step is done. */
const NEW_FIGHTER_DAYS = 30;
/** Belt stripes stand for the share of open goals on track. */
const GOAL_STRIPES = 4;

/**
 * The fighter's Today page answers one question: what do I do now? The fight camp and next session lead,
 * one strip carries readiness, then this week and the latest from the corner. Everything else lives in its hub.
 */
export default async function FighterDashboardPage({ searchParams }: PageProps<"/fighter/dashboard">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
    // The profile read runs beside the page's own reads instead of ahead of them.
    const fighterRead = requireFighterAccess(user, fighterId);
    const ids = [fighterId];
    const [query, { t, locale }] = await Promise.all([searchParams, getTranslator()]);
    // The bouts service is separate from training: without it Today still shows, minus the weigh-in card.
    const boutsRead = nullIfServiceFails(listBouts({ fighterIds: ids }));

    const now = new Date().toISOString();
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const nextWeekStart = academyDayStartIso(addDaysToKey(weekKey, 7));

    // The active plan's sessions chain onto the plan list, so they don't wait for the rest of the batch.
    const plansRead = listPlans({ fighterIds: ids });
    const [fighter, bouts, health, upcoming, weekSessions, plans, planDetail, videos, feedback, goals, coaches, doctors] = await Promise.all([
        fighterRead,
        boutsRead,
        getFighterHealthSummary(fighterId, now),
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
    const runningBout = bouts ? activeBout(bouts) : null;

    const activePlan = planDetail?.plan ?? null;
    const adherence = planDetail ? planAdherence(planDetail.sessions, now) : null;
    const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]));
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const { clearance, clearanceState } = health;
    const paused = clearanceState === "not_cleared" || clearanceState === "expired";
    const nextSession = upcoming[0] ?? null;
    // A bout from the bouts service wins over the older `upcomingBout` on the profile, so Today never shows two fights.
    const bout = fighter.upcomingBout;
    const heroBout: HeroBout | null = runningBout
        ? {
              event: runningBout.eventName,
              opponent: runningBout.opponentName ?? t("bout.opponentTba"),
              date: runningBout.boutAt,
              detail: `${formatNumber(runningBout.catchweightKg ?? runningBout.weightLimitKg, 1)} kg`,
          }
        : bout
          ? { event: bout.event, opponent: bout.opponent, date: bout.date, detail: WEIGHT_CLASS_LABELS[bout.weightClass] }
          : null;
    const linkedCamp = runningBout?.trainingPlanId ? plans.find((plan) => plan.id === runningBout.trainingPlanId) : undefined;
    const campStart = linkedCamp?.startDate ?? (activePlan && isCampFor(activePlan, heroBout) ? activePlan.startDate : null);
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
                            {t("fighterToday.noClearanceNote")}
                        </InlineNote>
                    ) : clearanceState === "restricted" ? (
                        <InlineNote icon={ShieldAlert} tone="info">
                            {t("fighterToday.restrictedNote")}
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
            ? onboardingSteps({ clearanceState, videos, plans, activePlan, goalCount: goalsAvailable ? goals.length : null }, t)
            : [];

    return (
        <>
            <FlashToast
                notice={param(query.notice) === WEIGHT_SAVED_NOTICE ? { title: t("weight.saved") } : null}
                cleanHref={routes.fighter.dashboard}
            />
            <PageHeader
                eyebrow={formatWeekdayDate(now, locale)}
                title={t("greeting.named", { greeting: t(greetingKey(now)), name: firstName(fighter.name) })}
                actions={
                    <ButtonLink href={routes.fighter.uploadVideo} variant="secondary">
                        <Upload aria-hidden />
                        {t("fighterToday.uploadVideo")}
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                <FightHero
                    bout={heroBout}
                    campStart={campStart}
                    plan={
                        activePlan
                            ? { title: activePlan.title, href: routes.fighter.plan(activePlan.id), phase: activePlan.phase, adherencePct: adherence?.pct ?? null }
                            : null
                    }
                    next={next}
                    now={now}
                    t={t}
                    locale={locale}
                />

                {onboarding.some((step) => !step.done) && <OnboardingStrip steps={onboarding} locale={locale} />}

                <ReadinessStrip label={t("fighterToday.readiness")}>
                    <ReadinessCell
                        label={t("fighterToday.medicalClearance")}
                        value={<ClearanceBadge state={clearanceState} locale={locale} />}
                        hint={clearanceHint(t, locale, clearanceState, clearance)}
                        href={routes.fighter.health}
                        className="col-span-2 sm:col-span-2 lg:col-span-1"
                    />
                    <ReadinessCell
                        label={t("fighterToday.health")}
                        value={<HealthStatusBadge status={health.fighter.healthStatus} locale={locale} />}
                        hint={
                            health.nextFollowUp
                                ? `${t("fighterToday.followUp", { date: formatShortDate(health.nextFollowUp.date, locale) })}${followUpDoctor ? ` · ${followUpDoctor}` : ""}`
                                : t(`healthDescription.${health.fighter.healthStatus}`)
                        }
                        href={routes.fighter.health}
                        className="sm:col-span-2 lg:col-span-1"
                    />
                    {runningBout ? (
                        <BoutWeightCell bout={runningBout} t={t} locale={locale} className="sm:col-span-2 lg:col-span-1" />
                    ) : (
                        <ReadinessCell
                            label={t("weight.title")}
                            value={
                                weight ? (
                                    <ReadinessNumber value={formatNumber(weight.currentKg, 1)} unit="kg" />
                                ) : (
                                    <span className="text-sm font-medium text-fg-muted">{NOT_RECORDED}</span>
                                )
                            }
                            hint={weight ? `${weightGapText(weight, t)} · ${weightLimit}` : t("weightGap.limit", { limit: weightLimit })}
                            href={routes.profile}
                            className="sm:col-span-2 lg:col-span-1"
                        />
                    )}
                    <ReadinessCell
                        label={t("fighterToday.thisWeek")}
                        value={<ReadinessNumber value={weekCompleted} unit={t("fighterToday.sessionsDone", { total: weekPlanned.length })} />}
                        hint={weekHint(t, { planned: weekPlanned.length, toGo: weekToGo, missed: weekMissed, paused })}
                        href={routes.fighter.schedule}
                        className="sm:col-span-3 lg:col-span-1"
                    >
                        {weekPlanned.length > 0 && (
                            <ProgressBar
                                value={weekCompleted}
                                max={weekPlanned.length}
                                size="sm"
                                hideValue
                                label={t("fighterToday.sessionsDoneLabel")}
                                valueText={t("fighterToday.sessionsDoneValue", { done: weekCompleted, total: weekPlanned.length })}
                            />
                        )}
                    </ReadinessCell>
                    <ReadinessCell
                        label={t("fighterToday.goals")}
                        value={
                            openGoals.length > 0 ? (
                                <ReadinessNumber value={onTrack} unit={t("fighterToday.goalsOnTrack", { total: openGoals.length })} />
                            ) : (
                                <span className="text-sm font-medium text-fg-muted">{t(goalsAvailable ? "fighterToday.noOpenGoals" : "fighterToday.goalsUnavailable")}</span>
                            )
                        }
                        hint={
                            !goalsAvailable
                                ? t("fighterToday.goalsLater")
                                : openGoals.length === 0
                                  ? t("fighterToday.agreeGoal")
                                  : atRisk > 0
                                    ? plural(t, "fighterToday.goalsAtRisk", atRisk)
                                    : t("fighterToday.allGoalsOnTrack")
                        }
                        href={routes.fighter.goals}
                        className="sm:col-span-3 lg:col-span-1"
                    >
                        {openGoals.length > 0 && (
                            <BeltProgress
                                stripes={(onTrack / openGoals.length) * GOAL_STRIPES}
                                max={GOAL_STRIPES}
                                label={t("fighterToday.goalsBelt", { onTrack, total: openGoals.length })}
                            />
                        )}
                    </ReadinessCell>
                </ReadinessStrip>

                <Card className="min-w-0">
                    <CardHeader
                        title={t("fighterToday.weekTitle")}
                        description={t("fighterToday.weekDescription", {
                            start: formatShortDate(weekStart, locale),
                            end: formatShortDate(addDaysToKey(weekKey, 6), locale),
                            sessions: paused && weekPlanned.length === 0 ? t("fighterToday.trainingPaused") : plural(t, "fighterToday.weekSessions", weekPlanned.length),
                        })}
                        icon={<CalendarDays />}
                        action={<CardLink href={routes.fighter.schedule}>{t("fighterToday.fullSchedule")}</CardLink>}
                    />
                    <CardContent>
                        <WeekAgenda sessions={weekSessions} startDate={weekStart} now={now} getHref={(session) => routes.fighter.session(session.id)} locale={locale} />
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
                    locale={locale}
                />
            </div>
        </>
    );
}

function clearanceHint(t: Translator, locale: Locale, state: ClearanceState, clearance: MedicalClearance | null): string {
    switch (state) {
        case "full":
            return clearance?.validUntil ? t("clearanceHint.full", { date: formatShortDate(clearance.validUntil, locale) }) : t("clearanceHint.fullOpen");
        case "restricted":
            return plural(t, "clearanceHint.restricted", clearance?.restrictions.length ?? 0);
        case "none":
            return t("clearanceHint.none");
        case "expired":
            return t("clearanceHint.expired");
        case "not_cleared":
            return t("clearanceHint.not_cleared");
    }
}

function weekHint(t: Translator, { planned, toGo, missed, paused }: { planned: number; toGo: number; missed: number; paused: boolean }): string {
    if (planned === 0) return t(paused ? "weekHint.paused" : "weekHint.nothing");
    const parts = [toGo > 0 ? t("weekHint.toGo", { n: toGo }) : null, missed > 0 ? t("weekHint.missed", { n: missed }) : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : t("weekHint.allDone");
}

/** Whether a plan is the fight camp for the booked bout: a fight-camp plan whose window includes fight night. */
function isCampFor(plan: TrainingPlan, bout: Pick<HeroBout, "date"> | null): boolean {
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
function onboardingSteps({ clearanceState, videos, plans, activePlan, goalCount }: OnboardingInput, t: Translator): OnboardingStep[] {
    const analysed = videos.some((item) => item.video.status === "completed");
    const failedUpload = videos.some((item) => item.video.status === "failed");
    const draftPlan = plans.some((plan) => plan.status === "draft");
    const steps: OnboardingStep[] = [
        {
            id: "medical",
            title: t("onboarding.medical.title"),
            done: clearanceState !== "none",
            description:
                clearanceState !== "none"
                    ? t("onboarding.medical.done")
                    : t("onboarding.medical.todo"),
            href: routes.fighter.health,
            actionLabel: t("onboarding.medical.action"),
        },
        {
            id: "video",
            title: t("onboarding.video.title"),
            done: analysed,
            description: analysed
                ? t("onboarding.video.done")
                : failedUpload
                  ? t("onboarding.video.failed")
                  : t("onboarding.video.todo"),
            href: routes.fighter.uploadVideo,
            actionLabel: t("onboarding.video.action"),
        },
        {
            id: "plan",
            title: t("onboarding.plan.title"),
            done: activePlan !== null,
            description: activePlan
                ? t("onboarding.plan.active", { title: activePlan.title })
                : draftPlan
                  ? t("onboarding.plan.draft")
                  : t("onboarding.plan.todo"),
            href: routes.fighter.schedule,
            actionLabel: t("onboarding.plan.action"),
        },
    ];
    if (goalCount === null) return steps;
    return [
        ...steps,
        {
            id: "goals",
            title: t("onboarding.goals.title"),
            done: goalCount > 0,
            description: goalCount > 0 ? plural(t, "onboarding.goals.count", goalCount) : t("onboarding.goals.todo"),
            href: routes.fighter.goals,
            actionLabel: t("onboarding.goals.action"),
        },
    ];
}
