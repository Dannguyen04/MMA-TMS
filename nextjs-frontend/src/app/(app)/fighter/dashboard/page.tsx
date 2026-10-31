import { CalendarDays, CircleCheck, ShieldAlert, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { CornerFeed } from "@/components/dashboard/corner-feed";
import { cornerFeedItems, headlineFinding } from "@/components/dashboard/corner-feed-items";
import { firstName, greetingKey, weightCheck, weightGapText } from "@/components/dashboard/dashboard-utils";
import { FightHero, isSessionLive, type HeroAnalysis, type NextUp } from "@/components/dashboard/fight-hero";
import { InlineNote } from "@/components/dashboard/inline-note";
import { ReadinessCell, ReadinessNumber, ReadinessStrip } from "@/components/dashboard/readiness-strip";
import { FighterJourney } from "@/components/domain/fighter-journey";
import { FighterWeightCard } from "@/components/domain/fighter-weight-card";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { Callout } from "@/components/training/callout";
import { weekStartKey } from "@/components/training/training-utils";
import { BeltProgress } from "@/components/ui/belt-progress";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { reviewCounts } from "@/lib/domain/ai-review";
import { journeyOwnerLabel, journeyStep, localizeJourney, type FighterJourney as Journey, type JourneyCode, type JourneyStep, type JourneyStepId } from "@/lib/domain/journey";
import { savedWeightMessage } from "@/lib/domain/nutrition";
import { WEIGHT_CLASS_LIMIT_KG, weightClassLabel } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import { planAdherence } from "@/lib/domain/training-plan";
import type { AIAnalysis, MedicalClearance, TrainingPlan, TrainingSession, UpcomingBout } from "@/lib/domain/types";
import { academyDayStartIso, addDaysToKey, dayKey, daysBetween, formatNumber, formatShortDate, formatWeekdayDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getCurrentBout, getWeightTrack } from "@/lib/services/bouts";
import { getFighterJourney } from "@/lib/services/fighter-journey";
import { listGoals } from "@/lib/services/goals";
import { getFighterHealthSummary } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getPlanWithSessions, getUpcomingSessions, listCoachFeedback, listPlans, listSessions } from "@/lib/services/training";
import { getVideoDetail, listVideoLibrary, type VideoLibraryItem } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("nav.Today") };
}

/** Belt stripes stand for the share of open goals on track. */
const GOAL_STRIPES = 4;

/**
 * The fighter's Today page answers one question: what do I do now? Until training can start, the hero walks the
 * fighter's journey (sports doctor, baseline exam, Medical Clearance) and names who each step waits on. Once cleared,
 * the AI leads: upload a round, or read what it found. Then one strip of readiness, this week and the corner feed.
 */
export default async function FighterDashboardPage({ searchParams }: PageProps<"/fighter/dashboard">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const ids = [fighter.id];
    const [query, { t, locale }] = await Promise.all([searchParams, getTranslator()]);
    const notice = param(query.notice);

    const now = new Date().toISOString();
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const nextWeekStart = academyDayStartIso(addDaysToKey(weekKey, 7));

    // Reads that build on another chain onto it, so they don't wait for the rest of the batch. Video analysis is a
    // separate service: when it doesn't answer, the day's training still shows and the journey marks that step unknown.
    const plansRead = listPlans({ fighterIds: ids });
    const videosRead = nullIfServiceFails(listVideoLibrary({ fighterIds: ids }));
    const [health, upcoming, weekSessions, planDetail, videoItems, latest, journeyRead, feedback, goals, coaches, doctors, camp] = await Promise.all([
        getFighterHealthSummary(fighter.id, now),
        getUpcomingSessions(ids, 1),
        listSessions({ fighterIds: ids, from: weekStart, to: new Date(Date.parse(nextWeekStart) - 1).toISOString() }),
        plansRead.then((list) => {
            const active = list.find((plan) => plan.status === "active");
            return active ? getPlanWithSessions(active.id) : null;
        }),
        videosRead,
        videosRead.then(latestAnalysis),
        getFighterJourney(fighter.id, { viewer: "fighter", plans: plansRead, videos: videosRead.then((items) => items?.map((item) => item.video) ?? null) }),
        listCoachFeedback({ fighterIds: ids }),
        listGoals({ fighterIds: ids }),
        listCoaches(),
        listDoctors(),
        // The running bout's camp weight (T-005): a card above the fight hero, only while a bout is running.
        getCurrentBout(fighter.id).then(async (current) => ({ bout: current, track: current ? await getWeightTrack(current.id) : null })),
    ]);
    if (!health) notFound();
    const journey = localizeJourney(journeyRead, t);
    const savedWeight = savedWeightMessage(param(query.saved), param(query.status), t);

    const videos = videoItems ?? [];
    const activePlan = planDetail?.plan ?? null;
    const adherence = planDetail ? planAdherence(planDetail.sessions, now) : null;
    const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]));
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const { clearance, clearanceState } = health;
    const paused = clearanceState === "not_cleared" || clearanceState === "expired";
    const bout = fighter.upcomingBout;
    const followUpDoctor = health.nextFollowUp ? doctorNames.get(health.nextFollowUp.examination.doctorId) : undefined;
    const clearanceDoctor = clearance ? doctorNames.get(clearance.doctorId) : undefined;

    const next = nextUpFor({
        journey,
        session: upcoming[0] ?? null,
        videos,
        now,
        coachName: (id) => coachNames.get(id),
        restricted: clearanceState === "restricted",
        doctorName: followUpDoctor ?? clearanceDoctor,
        followUpDate: health.nextFollowUp?.date ?? null,
        t,
    });
    const analysis = latest ? heroAnalysis(latest.item, latest.analysis) : null;
    // Until training can start, the journey leads the hero. Once cleared, the fight camp or the latest AI analysis leads,
    // and any steps left (a plan, a first analysis) sit in a strip underneath.
    const journeyInHero = !journey.complete && (journey.cleared !== true || (!bout && !analysis));

    // This week, counted from the same academy week the agenda shows.
    const weekPlanned = weekSessions.filter((session) => session.status !== "cancelled");
    const weekCompleted = weekPlanned.filter((session) => session.status === "completed").length;
    const weekMissed = weekPlanned.filter((session) => session.status === "missed").length;
    const weekToGo = weekPlanned.filter((session) => session.status === "scheduled" || session.status === "in_progress").length;

    const weightClass = bout?.weightClass ?? fighter.weightClass;
    const weight = fighter.weightKg === null ? null : weightCheck(fighter.weightKg, weightClass, bout ? Math.max(0, daysBetween(now, bout.date)) : null);
    const weightLimit = `${weightClassLabel(weightClass, locale)} ${formatNumber(WEIGHT_CLASS_LIMIT_KG[weightClass], 1)} kg`;

    const goalsAvailable = platformFeatureAvailable("goals");
    const openGoals = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = openGoals.filter((goal) => goal.status === "at_risk").length;
    const onTrack = openGoals.length - atRisk;

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now, locale)}
                title={t("greeting.named", { greeting: t(greetingKey(now)), name: firstName(fighter.name) })}
                actions={
                    next.kind !== "analyse" && (
                        <ButtonLink href={routes.fighter.uploadVideo} variant="secondary">
                            <Upload aria-hidden />
                            {t("fighterToday.uploadVideo")}
                        </ButtonLink>
                    )
                }
            />

            <div className="flex flex-col gap-6">
                {notice === "activated" && (
                    <Callout tone="success" icon={CircleCheck} title={t("fighterToday.activated.title")} role="status">
                        {activatedNextStep(journey, t)}
                    </Callout>
                )}
                {savedWeight && <Callout tone="success" icon={CircleCheck} role="status" title={savedWeight} />}

                {camp.bout && <FighterWeightCard event={camp.bout.event} track={camp.track} locale={locale} />}

                <FightHero
                    bout={bout}
                    campStart={activePlan && isCampFor(activePlan, bout) ? activePlan.startDate : null}
                    plan={
                        activePlan
                            ? { title: activePlan.title, href: routes.fighter.plan(activePlan.id), phase: activePlan.phase, adherencePct: adherence?.pct ?? null }
                            : null
                    }
                    journey={journeyInHero ? journey : null}
                    analysis={analysis}
                    next={next}
                    now={now}
                    t={t}
                    locale={locale}
                />

                {!journey.complete && !journeyInHero && <FighterJourney journey={journey} variant="compact" locale={locale} />}

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
                    <ReadinessCell
                        label={t("weight.title")}
                        value={
                            weight ? (
                                <ReadinessNumber value={formatNumber(weight.currentKg, 1)} unit="kg" />
                            ) : (
                                <span className="text-sm font-medium text-fg-muted">{t("training.table.notRecorded")}</span>
                            )
                        }
                        hint={weight ? `${weightGapText(weight, t)} · ${weightLimit}` : t("weightGap.limit", { limit: weightLimit })}
                        href={routes.profile}
                        className="sm:col-span-2 lg:col-span-1"
                    />
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

/* ─── The hero's next step ────────────────────────────────────────────────── */

const MEDICAL_STEPS: ReadonlySet<JourneyStepId> = new Set(["doctor", "baseline", "clearance"]);

/** What each medical blocker means for the fighter, in plain words. */
const BLOCKER_BODY: Partial<Record<JourneyCode, MessageKey>> = {
    doctor_missing: "fighterToday.blocker.doctor_missing",
    baseline_pending: "fighterToday.blocker.baseline_pending",
    clearance_pending: "fighterToday.blocker.clearance_pending",
    review_pending: "fighterToday.blocker.review_pending",
    clearance_unspecified: "fighterToday.blocker.unexplained",
    unknown: "fighterToday.blocker.unknown",
};

const BLOCKER_TITLE: Partial<Record<JourneyCode, MessageKey>> = {
    review_pending: "fighterToday.blocker.review_pending.title",
    unknown: "fighterToday.blocker.unknown.title",
};

const LOADING_STATUSES: ReadonlySet<VideoLibraryItem["video"]["status"]> = new Set(["uploading", "queued", "processing"]);

const newestFirst = (items: readonly VideoLibraryItem[]) => [...items].sort((a, b) => Date.parse(b.video.uploadedAt) - Date.parse(a.video.uploadedAt));

interface NextUpInput {
    journey: Journey;
    session: TrainingSession | null;
    videos: VideoLibraryItem[];
    now: string;
    coachName: (coachId: string) => string | undefined;
    restricted: boolean;
    doctorName: string | undefined;
    followUpDate: string | null;
    t: Translator;
}

/**
 * The hero's right half. Before clearance: the medical step in the way and who it's with (the paused copy when a
 * doctor stopped training). Once cleared: a session under way, an upload still processing, the first analysis, the next
 * session, then another round for the AI.
 */
function nextUpFor({ journey, session, videos, now, coachName, restricted, doctorName, followUpDate, t }: NextUpInput): NextUp {
    if (journey.cleared !== true) {
        const blocker = medicalBlocker(journey);
        if (blocker.code === "not_eligible" || blocker.code === "clearance_expired") {
            return { kind: "paused", reason: blocker.code === "clearance_expired" ? "expired" : "not_cleared", doctorName, followUpDate, healthHref: routes.fighter.health };
        }
        const titleKey = BLOCKER_TITLE[blocker.code];
        return {
            kind: "blocked",
            title: titleKey ? t(titleKey) : blocker.detail,
            body: t(BLOCKER_BODY[blocker.code] ?? "fighterToday.blocker.unexplained"),
            owner: blocker.person ?? journeyOwnerLabel(blocker.owner, "fighter", t),
            attention: blocker.attention,
            healthHref: routes.fighter.health,
        };
    }

    const sessionUp = (current: TrainingSession): NextUp => ({
        kind: "session",
        session: current,
        coachName: current.coachId ? coachName(current.coachId) : undefined,
        href: routes.fighter.session(current.id),
        note: restricted ? (
            <InlineNote icon={ShieldAlert} tone="info">
                {t("fighterToday.restrictedNote")}
            </InlineNote>
        ) : undefined,
    });
    const analyse = (reason: "first" | "again" | "retry"): NextUp => ({ kind: "analyse", reason, uploadHref: routes.fighter.uploadVideo, liveCheckHref: routes.fighter.liveCheck });

    if (session && isSessionLive(session, now)) return sessionUp(session);
    const [newest] = newestFirst(videos);
    if (newest && LOADING_STATUSES.has(newest.video.status)) {
        return { kind: "processing", videoTitle: newest.video.title, uploadedAt: newest.video.uploadedAt, href: routes.fighter.video(newest.video.id) };
    }
    const analysis = journeyStep(journey, "analysis");
    if (analysis.code === "analysis_missing") return analyse("first");
    if (analysis.code === "analysis_failed") return analyse("retry");
    return session ? sessionUp(session) : analyse("again");
}

/** The medical step holding training up: the one in progress, else the first that couldn't be read. */
function medicalBlocker(journey: Journey): JourneyStep {
    if (journey.active && MEDICAL_STEPS.has(journey.active.id)) return journey.active;
    return journey.steps.find((step) => MEDICAL_STEPS.has(step.id) && step.status !== "done") ?? journeyStep(journey, "clearance");
}

/** After activation, the next step in one sentence. */
function activatedNextStep(journey: Journey, t: Translator): string {
    const active = journey.active;
    switch (active?.code) {
        case "doctor_missing":
            return t("fighterToday.activated.doctor");
        case "baseline_pending":
            return active.person ? t("fighterToday.activated.baselineWith", { name: active.person }) : t("fighterToday.activated.baseline");
        case "clearance_pending":
            return t("fighterToday.activated.clearance");
        default:
            return t("fighterToday.activated.below");
    }
}

/* ─── AI analysis ─────────────────────────────────────────────────────────── */

/** The newest finished analysis, with its findings. Null when there is none or the analysis service doesn't answer. */
async function latestAnalysis(items: VideoLibraryItem[] | null): Promise<{ item: VideoLibraryItem; analysis: AIAnalysis } | null> {
    const item = newestFirst(items ?? []).find((candidate) => candidate.video.status === "completed");
    if (!item) return null;
    const detail = await nullIfServiceFails(getVideoDetail(item.video.id));
    return detail?.analysis ? { item, analysis: detail.analysis } : null;
}

function heroAnalysis(item: VideoLibraryItem, analysis: AIAnalysis): HeroAnalysis {
    const headline = headlineFinding(analysis.findings);
    return {
        href: routes.fighter.video(item.video.id),
        videoTitle: item.video.title,
        processedAt: analysis.processedAt,
        headline: headline ? { title: headline.title, confidence: headline.confidence, review: headline.review } : null,
        coachReviewer: analysis.coachReview?.reviewerName ?? null,
        lowConfidenceDetections: reviewCounts(analysis).lowConfidenceDetections,
    };
}

/* ─── Readiness ───────────────────────────────────────────────────────────── */

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
function isCampFor(plan: TrainingPlan, bout: UpcomingBout | null): boolean {
    if (!bout || plan.phase !== "fight_camp") return false;
    const fightDay = dayKey(bout.date);
    return dayKey(plan.startDate) <= fightDay && (plan.endDate === null || fightDay <= dayKey(plan.endDate));
}
