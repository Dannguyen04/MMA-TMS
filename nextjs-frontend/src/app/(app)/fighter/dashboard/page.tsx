import { CalendarDays, CircleCheck, ShieldAlert, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { CornerFeed } from "@/components/dashboard/corner-feed";
import { cornerFeedItems, headlineFinding } from "@/components/dashboard/corner-feed-items";
import { firstName, greetingFor, weightCheck, weightGapText } from "@/components/dashboard/dashboard-utils";
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
import { NOT_RECORDED } from "@/components/domain/domain-format";
import { reviewCounts } from "@/lib/domain/ai-review";
import { journeyOwnerLabel, journeyStep, type FighterJourney as Journey, type JourneyCode, type JourneyStep, type JourneyStepId } from "@/lib/domain/journey";
import { savedWeightMessage } from "@/lib/domain/nutrition";
import { HEALTH_STATUS_DESCRIPTIONS, WEIGHT_CLASS_LABELS, WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import { planAdherence } from "@/lib/domain/training-plan";
import type { AIAnalysis, MedicalClearance, TrainingPlan, TrainingSession, UpcomingBout } from "@/lib/domain/types";
import { academyDayStartIso, addDaysToKey, dayKey, daysBetween, formatNumber, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
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

export const metadata: Metadata = { title: "Today" };

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
    const query = await searchParams;
    const notice = param(query.notice);

    const now = new Date().toISOString();
    const weekKey = weekStartKey(now);
    const weekStart = academyDayStartIso(weekKey);
    const nextWeekStart = academyDayStartIso(addDaysToKey(weekKey, 7));

    // Reads that build on another chain onto it, so they don't wait for the rest of the batch. Video analysis is a
    // separate service: when it doesn't answer, the day's training still shows and the journey marks that step unknown.
    const plansRead = listPlans({ fighterIds: ids });
    const videosRead = nullIfServiceFails(listVideoLibrary({ fighterIds: ids }));
    const [health, upcoming, weekSessions, planDetail, videoItems, latest, journey, feedback, goals, coaches, doctors, camp] = await Promise.all([
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
    const savedWeight = savedWeightMessage(param(query.saved), param(query.status));

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
    const weightLimit = `${WEIGHT_CLASS_LABELS[weightClass]} ${formatNumber(WEIGHT_CLASS_LIMIT_KG[weightClass], 1)} kg`;

    const goalsAvailable = platformFeatureAvailable("goals");
    const openGoals = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = openGoals.filter((goal) => goal.status === "at_risk").length;
    const onTrack = openGoals.length - atRisk;

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title={`${greetingFor(now)}, ${firstName(fighter.name)}`}
                actions={
                    next.kind !== "analyse" && (
                        <ButtonLink href={routes.fighter.uploadVideo} variant="secondary">
                            <Upload aria-hidden />
                            Upload video
                        </ButtonLink>
                    )
                }
            />

            <div className="flex flex-col gap-6">
                {notice === "activated" && (
                    <Callout tone="success" icon={CircleCheck} title="Your fighter account is active" role="status">
                        {activatedNextStep(journey)}
                    </Callout>
                )}
                {savedWeight && <Callout tone="success" icon={CircleCheck} role="status" title={savedWeight} />}

                {camp.bout && <FighterWeightCard event={camp.bout.event} track={camp.track} />}

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
                />

                {!journey.complete && !journeyInHero && <FighterJourney journey={journey} variant="compact" />}

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
                        value={<HealthStatusBadge status={health.fighter.healthStatus} />}
                        hint={
                            health.nextFollowUp
                                ? `Follow-up ${formatShortDate(health.nextFollowUp.date)}${followUpDoctor ? ` · ${followUpDoctor}` : ""}`
                                : HEALTH_STATUS_DESCRIPTIONS[health.fighter.healthStatus]
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

/* ─── The hero's next step ────────────────────────────────────────────────── */

const MEDICAL_STEPS: ReadonlySet<JourneyStepId> = new Set(["doctor", "baseline", "clearance"]);

const UNEXPLAINED_BLOCKER = "Your sports doctor hasn't cleared you to train yet. Ask them what's needed before your first session.";

/** What each medical blocker means for the fighter, in plain words. */
const BLOCKER_BODY: Partial<Record<JourneyCode, string>> = {
    doctor_missing: "Your sports doctor runs your baseline exam and issues your Medical Clearance. There's nothing you need to do yet.",
    baseline_pending: "A full check while you're healthy: vitals, heart, nerves, joints and a concussion screen. Training starts once you're cleared.",
    clearance_pending: "Your baseline exam is on file. Your sports doctor issues your Medical Clearance next; it says what training you're cleared for.",
    review_pending: "A review of your fitness to train was requested. Training waits until your sports doctor examines you.",
    clearance_unspecified: UNEXPLAINED_BLOCKER,
    unknown: "Your medical status didn't load, so we can't say yet whether you can train. Check your health page or try again shortly.",
};

const BLOCKER_TITLE: Partial<Record<JourneyCode, string>> = {
    review_pending: "Medical review pending",
    unknown: "We couldn't check your Medical Clearance",
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
}

/**
 * The hero's right half. Before clearance: the medical step in the way and who it's with (the paused copy when a
 * doctor stopped training). Once cleared: a session under way, an upload still processing, the first analysis, the next
 * session, then another round for the AI.
 */
function nextUpFor({ journey, session, videos, now, coachName, restricted, doctorName, followUpDate }: NextUpInput): NextUp {
    if (journey.cleared !== true) {
        const blocker = medicalBlocker(journey);
        if (blocker.code === "not_eligible" || blocker.code === "clearance_expired") {
            return { kind: "paused", reason: blocker.code === "clearance_expired" ? "expired" : "not_cleared", doctorName, followUpDate, healthHref: routes.fighter.health };
        }
        return {
            kind: "blocked",
            title: BLOCKER_TITLE[blocker.code] ?? blocker.detail,
            body: BLOCKER_BODY[blocker.code] ?? UNEXPLAINED_BLOCKER,
            owner: blocker.person ?? journeyOwnerLabel(blocker.owner, "fighter"),
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
                You&apos;re cleared with restrictions — your coach plans every session within them.
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
function activatedNextStep(journey: Journey): string {
    const active = journey.active;
    switch (active?.code) {
        case "doctor_missing":
            return "Next: the academy assigns your sports doctor.";
        case "baseline_pending":
            return `Next: your baseline exam with ${active.person ?? "your sports doctor"}.`;
        case "clearance_pending":
            return "Next: your sports doctor issues your Medical Clearance.";
        default:
            return "Your next step is right below.";
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

function clearanceHint(state: ClearanceState, clearance: MedicalClearance | null): string {
    switch (state) {
        case "full":
            return clearance?.validUntil ? `Valid until ${formatShortDate(clearance.validUntil)}` : "Cleared for full training";
        case "restricted":
            return `${pluralize(clearance?.restrictions.length ?? 0, "restriction")} · your coach plans around them`;
        case "none":
            return "Issued after your baseline exam";
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
