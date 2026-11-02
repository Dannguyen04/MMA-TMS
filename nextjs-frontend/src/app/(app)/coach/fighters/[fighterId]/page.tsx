import { CalendarClock, ClipboardList, ClipboardPlus, Lock, MessageSquareText, Upload } from "lucide-react";
import type { Metadata } from "next";

import { AnalysisSummaryCard } from "@/components/dashboard/analysis-summary-card";
import { CardLink } from "@/components/dashboard/card-link";
import { fighterSessionsHref } from "@/components/dashboard/coach-attention";
import { relativeDayText } from "@/components/dashboard/dashboard-utils";
import { HealthStatusCard } from "@/components/dashboard/health-status-card";
import { BodyProfileCard, GoalsSnapshotCard, UpcomingSessionsCard } from "@/components/dashboard/profile-overview-cards";
import { loadRosterEntry } from "@/components/dashboard/roster-data";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { FighterJourney } from "@/components/domain/fighter-journey";
import { ReviewRequestCard } from "@/components/medical/review-request-card";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { PlanCard } from "@/components/domain/plan-card";
import { localizeJourney, type JourneyCode } from "@/lib/domain/journey";
import { planAdherencePct } from "@/lib/domain/training-plan";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { hasPermission, requireRole } from "@/lib/auth/session";
import { formatWeekdayDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getFighterJourney } from "@/lib/services/fighter-journey";
import { listGoals } from "@/lib/services/goals";
import { getClearanceStatus, getFighterHealthSummary, listReviewRequests } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { getPlanWithSessions, listCoachFeedback, listPlans } from "@/lib/services/training";
import { getVideoDetail, listVideoLibrary } from "@/lib/services/videos";
import { cn } from "@/lib/utils";

const UPCOMING_LIMIT = 3;
const FEEDBACK_LIMIT = 3;

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]">): Promise<Metadata> {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    return { title: fighter.name };
}

export default async function CoachFighterOverviewPage({ params }: PageProps<"/coach/fighters/[fighterId]">) {
    const { t, locale } = await getTranslator();
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    const now = new Date().toISOString();
    const ids = [fighter.id];

    // Reads that depend on another result chain onto it, so nothing waits for the whole first batch. The plans and the
    // video library are read once, for the cards and for the fighter's journey.
    const plansRead = listPlans({ fighterIds: ids });
    const libraryRead = listVideoLibrary({ fighterIds: ids });
    const [entry, planDetail, { latest, analysis }, journey, feedback, goals, coaches, doctors, health, settings, reviewRequests, { eligibility }] = await Promise.all([
        loadRosterEntry(user, fighter.id),
        plansRead.then((plans) => {
            const active = plans.find((plan) => plan.status === "active");
            return active ? getPlanWithSessions(active.id) : null;
        }),
        libraryRead.then(async (library) => {
            // The library carries no analysis in API mode, so the newest finished video's analysis is read on its own.
            const item = [...library].sort((a, b) => Date.parse(b.video.uploadedAt) - Date.parse(a.video.uploadedAt)).find((candidate) => candidate.video.status === "completed") ?? null;
            const detail = item ? await nullIfServiceFails(getVideoDetail(item.video.id)) : null;
            return { latest: item, analysis: detail?.analysis ?? null };
        }),
        getFighterJourney(fighter.id, { viewer: "coach", plans: plansRead, videos: libraryRead.then((library) => library.map((item) => item.video)) }),
        listCoachFeedback({ fighterIds: ids }),
        listGoals({ fighterIds: ids }),
        listCoaches(),
        listDoctors(),
        getFighterHealthSummary(fighter.id, now),
        getSettings(),
        listReviewRequests(fighter.id),
        getClearanceStatus(fighter.id, now),
    ]);
    const activePlan = planDetail?.plan ?? null;

    const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]));
    const doctorName = entry.clearance ? doctors.find((doctor) => doctor.id === entry.clearance?.doctorId)?.name : undefined;
    const followUp = health?.nextFollowUp ?? null;
    const firstName = fighter.name.split(" ")[0];

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            {!journey.complete && (
                <FighterJourney
                    journey={localizeJourney(journey, t)}
                    variant="compact"
                    locale={locale}
                    title={t("onboarding.title")}
                    action={journeyAction(journey.active?.code, fighter.id, t)}
                    className="lg:col-span-3"
                />
            )}

            <div className={cn("flex min-w-0 flex-col gap-6 lg:col-start-3", journey.complete ? "lg:row-start-1" : "lg:row-start-2")}>
                <ClearanceCard
                    clearance={entry.clearance}
                    state={entry.clearanceState}
                    doctorName={doctorName}
                    now={now}
                    variant="summary"
                    warningDays={settings.clearanceExpiryWarningDays}
                    pausedForReview={eligibility?.reasons.includes("REVIEW_REQUEST_PENDING")}
                    actions={<CardLink href={routes.coach.clearance}>{t("nav.Roster")}</CardLink>}
                />

                <ReviewRequestCard
                    fighterId={fighter.id}
                    fighterName={fighter.name}
                    audience="coach"
                    requests={reviewRequests}
                    eligibility={eligibility}
                    canRequest={hasPermission(user, "medical:request_review")}
                    now={now}
                />

                <HealthStatusCard status={health?.fighter.healthStatus ?? fighter.healthStatus} locale={locale}>
                    {followUp && (
                        <p className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[13px]">
                            <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                                {t("training.fighterOverview.nextMedicalFollowUp")}
                            </span>
                            <span className="text-right font-medium text-fg">
                                <time dateTime={followUp.date}>{formatWeekdayDate(followUp.date, locale)}</time>
                                <span className="block text-xs font-normal text-fg-muted">{relativeDayText(t, followUp.date, now)}</span>
                            </span>
                        </p>
                    )}
                    <p className="flex items-start gap-2 text-[13px] text-fg-muted">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                        {t("training.fighterOverview.doctorLockNotice")}
                    </p>
                </HealthStatusCard>

                {activePlan ? (
                    <PlanCard
                        plan={activePlan}
                        now={now}
                        coachName={coachNames.get(activePlan.coachId)}
                        adherencePct={planDetail ? planAdherencePct(planDetail.sessions, now) : undefined}
                        href={routes.coach.plan(activePlan.id)}
                        headingLevel={2}
                    />
                ) : (
                    <Card className="min-w-0">
                        <CardHeader title={t("training.fighterOverview.trainingPlanTitle")} icon={<ClipboardList />} />
                        <CardContent>
                            <EmptyState
                                compact
                                title={t("training.fighterOverview.noActivePlanTitle")}
                                description={t("training.fighterOverview.noActivePlanDesc", { name: firstName })}
                                action={
                                    <ButtonLink href={hrefWith(routes.coach.newPlan, {}, { fighter: fighter.id })} variant="secondary" size="sm">
                                        <ClipboardPlus aria-hidden />
                                        {t("training.fighterOverview.newTrainingPlan")}
                                    </ButtonLink>
                                }
                                className="pt-0"
                            />
                        </CardContent>
                    </Card>
                )}

                {platformFeatureAvailable("goals") && <GoalsSnapshotCard goals={goals} href={routes.coach.fighterGoals(fighter.id)} locale={locale} />}
            </div>

            <div className={cn("flex min-w-0 flex-col gap-6 lg:col-span-2 lg:col-start-1", journey.complete ? "lg:row-start-1" : "lg:row-start-2")}>
                <BodyProfileCard fighter={fighter} now={now} locale={locale} />

                <UpcomingSessionsCard
                    checks={entry.upcoming.slice(0, UPCOMING_LIMIT)}
                    coachNames={coachNames}
                    sessionHref={routes.coach.session}
                    allHref={fighterSessionsHref(fighter.id)}
                    emptyDescription={
                        entry.clearanceState === "not_cleared" || entry.clearanceState === "expired"
                            ? t("training.fighterOverview.trainingPaused")
                            : undefined
                    }
                    locale={locale}
                />

                <AnalysisSummaryCard
                    video={latest?.video ?? null}
                    analysis={analysis}
                    videoHref={latest ? routes.coach.video(latest.video.id) : null}
                    libraryHref={routes.coach.fighterVideos(fighter.id)}
                    uploadHref={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighter.id })}
                    now={now}
                    locale={locale}
                />

                {platformFeatureAvailable("coachFeedback") && (
                    <Card className="min-w-0">
                        <CardHeader title={t("training.fighterOverview.recentFeedbackTitle")} icon={<MessageSquareText />} />
                        <CardContent>
                            {feedback.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<MessageSquareText />}
                                    title={t("training.fighterOverview.noFeedbackTitle")}
                                    description={t("training.fighterOverview.noFeedbackDesc")}
                                    className="pt-0"
                                />
                            ) : (
                                <ul className="flex flex-col divide-y divide-border">
                                    {feedback.slice(0, FEEDBACK_LIMIT).map((item) => (
                                        <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                            <CoachFeedbackItem
                                                feedback={item}
                                                coachName={coachNames.get(item.coachId) ?? t("training.fighterOverview.coachFallback")}
                                                now={now}
                                                sessionHref={item.sessionId ? routes.coach.session(item.sessionId) : undefined}
                                                videoHref={item.videoId ? routes.coach.video(item.videoId) : undefined}
                                                locale={locale}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

/** The coach's own move on the journey, when the step in progress is theirs to take. */
function journeyAction(code: JourneyCode | undefined, fighterId: string, t: Translator) {
    if (code === "plan_missing" || code === "plan_draft") {
        return (
            <ButtonLink href={code === "plan_missing" ? hrefWith(routes.coach.newPlan, {}, { fighter: fighterId }) : routes.coach.fighterTraining(fighterId)} variant="secondary" size="sm">
                <ClipboardPlus aria-hidden />
                {code === "plan_missing" ? t("training.fighterOverview.newTrainingPlan") : t("screens.roster.overview.openTraining")}
            </ButtonLink>
        );
    }
    if (code === "analysis_missing" || code === "analysis_failed") {
        return (
            <ButtonLink href={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighterId })} variant="secondary" size="sm">
                <Upload aria-hidden />
                {t("screens.roster.overview.uploadVideo")}
            </ButtonLink>
        );
    }
    return undefined;
}
