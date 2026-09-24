import { CalendarClock, ClipboardList, ClipboardPlus, Lock, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";

import { AnalysisSummaryCard } from "@/components/dashboard/analysis-summary-card";
import { CardLink } from "@/components/dashboard/card-link";
import { fighterSessionsHref } from "@/components/dashboard/coach-attention";
import { relativeDay } from "@/components/dashboard/dashboard-utils";
import { HealthStatusCard } from "@/components/dashboard/health-status-card";
import { BodyProfileCard, GoalsSnapshotCard, UpcomingSessionsCard } from "@/components/dashboard/profile-overview-cards";
import { loadRosterEntry } from "@/components/dashboard/roster-data";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { PlanCard } from "@/components/domain/plan-card";
import { planAdherencePct } from "@/lib/domain/training-plan";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { formatWeekdayDate } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getAnalysis } from "@/lib/services/ai";
import { getSettings } from "@/lib/services/admin";
import { listGoals } from "@/lib/services/goals";
import { getFighterHealthSummary } from "@/lib/services/medical";
import { listCoaches, listDoctors } from "@/lib/services/people";
import { getPlanWithSessions, listCoachFeedback, listPlans } from "@/lib/services/training";
import { listVideoLibrary } from "@/lib/services/videos";

const UPCOMING_LIMIT = 3;
const FEEDBACK_LIMIT = 3;

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]">): Promise<Metadata> {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    return { title: fighter.name };
}

export default async function CoachFighterOverviewPage({ params }: PageProps<"/coach/fighters/[fighterId]">) {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    const now = new Date().toISOString();
    const ids = [fighter.id];

    // Reads that depend on another result chain onto it, so nothing waits for the whole first batch.
    const [entry, planDetail, { latest, analysis }, feedback, goals, coaches, doctors, health, settings] = await Promise.all([
        loadRosterEntry(user, fighter.id),
        listPlans({ fighterIds: ids, status: "active" }).then((plans) => (plans[0] ? getPlanWithSessions(plans[0].id) : null)),
        listVideoLibrary({ fighterIds: ids, status: "completed" }).then(async (library) => {
            const item = library.find((candidate) => candidate.analysis !== null) ?? null;
            return { latest: item, analysis: item?.analysis ? await getAnalysis(item.analysis.analysisId) : null };
        }),
        listCoachFeedback({ fighterIds: ids }),
        listGoals({ fighterIds: ids }),
        listCoaches(),
        listDoctors(),
        getFighterHealthSummary(fighter.id, now),
        getSettings(),
    ]);
    const activePlan = planDetail?.plan ?? null;

    const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]));
    const doctorName = entry.clearance ? doctors.find((doctor) => doctor.id === entry.clearance?.doctorId)?.name : undefined;
    const followUp = health?.nextFollowUp ?? null;

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-start-3 lg:row-start-1">
                <ClearanceCard
                    clearance={entry.clearance}
                    state={entry.clearanceState}
                    doctorName={doctorName}
                    now={now}
                    variant="summary"
                    warningDays={settings.clearanceExpiryWarningDays}
                    actions={<CardLink href={routes.coach.clearance}>Roster</CardLink>}
                />

                <HealthStatusCard status={fighter.healthStatus}>
                    {followUp && (
                        <p className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[13px]">
                            <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                                Next medical follow-up
                            </span>
                            <span className="text-right font-medium text-fg">
                                <time dateTime={followUp.date}>{formatWeekdayDate(followUp.date)}</time>
                                <span className="block text-xs font-normal text-fg-muted">{relativeDay(followUp.date, now)}</span>
                            </span>
                        </p>
                    )}
                    <p className="flex items-start gap-2 text-[13px] text-fg-muted">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                        Only the sports doctor can change health status and Medical Clearance.
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
                        <CardHeader title="Training plan" icon={<ClipboardList />} />
                        <CardContent>
                            <EmptyState
                                compact
                                title="No active plan"
                                description={`Build a plan so ${fighter.name.split(" ")[0]}'s sessions work toward one objective.`}
                                action={
                                    <ButtonLink href={hrefWith(routes.coach.newPlan, {}, { fighter: fighter.id })} variant="secondary" size="sm">
                                        <ClipboardPlus aria-hidden />
                                        New training plan
                                    </ButtonLink>
                                }
                                className="pt-0"
                            />
                        </CardContent>
                    </Card>
                )}

                <GoalsSnapshotCard goals={goals} href={routes.coach.fighterGoals(fighter.id)} />
            </div>

            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
                <BodyProfileCard fighter={fighter} now={now} />

                <UpcomingSessionsCard
                    checks={entry.upcoming.slice(0, UPCOMING_LIMIT)}
                    coachNames={coachNames}
                    sessionHref={routes.coach.session}
                    allHref={fighterSessionsHref(fighter.id)}
                    emptyDescription={
                        entry.clearanceState === "not_cleared" || entry.clearanceState === "expired"
                            ? "Training is paused until the sports doctor clears them."
                            : undefined
                    }
                />

                <AnalysisSummaryCard
                    video={latest?.video ?? null}
                    analysis={analysis}
                    videoHref={latest ? routes.coach.video(latest.video.id) : null}
                    libraryHref={routes.coach.fighterVideos(fighter.id)}
                    uploadHref={hrefWith(routes.coach.uploadVideo, {}, { fighter: fighter.id })}
                    now={now}
                />

                <Card className="min-w-0">
                    <CardHeader title="Recent feedback" icon={<MessageSquareText />} />
                    <CardContent>
                        {feedback.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<MessageSquareText />}
                                title="No feedback yet"
                                description="Feedback left on sessions and videos appears here."
                                className="pt-0"
                            />
                        ) : (
                            <ul className="flex flex-col divide-y divide-border">
                                {feedback.slice(0, FEEDBACK_LIMIT).map((item) => (
                                    <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                        <CoachFeedbackItem
                                            feedback={item}
                                            coachName={coachNames.get(item.coachId) ?? "Coach"}
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
        </div>
    );
}
