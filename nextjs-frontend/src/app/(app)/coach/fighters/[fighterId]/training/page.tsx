import { CalendarClock, CalendarPlus, ClipboardList, ClipboardPlus, History } from "lucide-react";
import type { Metadata } from "next";

import { CardLink } from "@/components/dashboard/card-link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PlanOverview } from "@/components/training/plan-overview";
import { SessionTable } from "@/components/training/session-table";
import { AdherenceChart } from "@/components/training/training-charts";
import { getCoachNames } from "@/components/training/training-data";
import { planAdherence, planAdherenceWeeks, recentAdherenceWeeks } from "@/components/training/training-utils";
import { UpcomingByDay } from "@/components/training/upcoming-by-day";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSessionHistory, getUpcomingSessions, listPlans, listSessions } from "@/lib/services/training";

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]/training">): Promise<Metadata> {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    return { title: `Training · ${fighter.name}` };
}

const UPCOMING_LIMIT = 6;
const HISTORY_LIMIT = 8;
const ADHERENCE_WEEKS = 8;

export default async function CoachFighterTrainingPage({ params }: PageProps<"/coach/fighters/[fighterId]/training">) {
    const user = await requireRole("coach");
    const fighter = await requireFighterAccess(user, (await params).fighterId);
    const now = new Date().toISOString();
    const firstName = fighter.name.split(" ")[0];

    const [plans, upcoming, history, sessions, coachNames] = await Promise.all([
        listPlans({ fighterIds: [fighter.id] }),
        getUpcomingSessions([fighter.id], UPCOMING_LIMIT),
        getSessionHistory(fighter.id, HISTORY_LIMIT),
        listSessions({ fighterIds: [fighter.id] }),
        getCoachNames(),
    ]);
    const activePlan = plans.find((plan) => plan.status === "active");
    const draftCount = plans.filter((plan) => plan.status === "draft").length;
    const planSessions = activePlan ? sessions.filter((session) => session.planId === activePlan.id) : [];
    // With an active plan the chart covers that plan, so it reports the same adherence as the plan overview.
    const adherenceWeeks = activePlan ? planAdherenceWeeks(activePlan, planSessions, now) : recentAdherenceWeeks(sessions, now, ADHERENCE_WEEKS);

    const scheduleHref = hrefWith(routes.coach.newSession, {}, { fighter: fighter.id, plan: activePlan?.id });
    const newPlanHref = hrefWith(routes.coach.newPlan, {}, { fighter: fighter.id });

    return (
        <section aria-labelledby="training-heading" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 id="training-heading" className="text-lg font-semibold text-fg">
                        Training
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">
                        {activePlan
                            ? `${firstName} is on “${activePlan.title}”${draftCount > 0 ? ` · ${pluralize(draftCount, "draft plan")}` : ""}.`
                            : `${firstName} has no active plan${draftCount > 0 ? ` · ${pluralize(draftCount, "draft plan")} waiting` : ""}.`}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ButtonLink href={newPlanHref} variant="secondary">
                        <ClipboardPlus aria-hidden />
                        New plan
                    </ButtonLink>
                    <ButtonLink href={scheduleHref}>
                        <CalendarPlus aria-hidden />
                        Schedule session
                    </ButtonLink>
                </div>
            </div>

            {activePlan ? (
                <PlanOverview
                    plan={activePlan}
                    now={now}
                    titleHref={routes.coach.plan(activePlan.id)}
                    titleAs="h3"
                    coachName={coachNames[activePlan.coachId]}
                    adherence={planAdherence(planSessions, now)}
                    actions={
                        <ButtonLink href={routes.coach.plan(activePlan.id)} variant="secondary" className="w-full sm:w-auto">
                            <ClipboardList aria-hidden />
                            Open plan
                        </ButtonLink>
                    }
                />
            ) : (
                <EmptyState
                    icon={<ClipboardList />}
                    title={`No active plan for ${firstName}`}
                    description="A plan sets the objective, phase and weekly target, and gives sessions an adherence baseline."
                    action={
                        <ButtonLink href={plans.length > 0 ? hrefWith(routes.coach.plans, {}, { fighter: fighter.id }) : newPlanHref} variant="secondary">
                            {plans.length > 0 ? "View their plans" : "Create a plan"}
                        </ButtonLink>
                    }
                />
            )}

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <Card className="min-w-0 overflow-hidden">
                    <CardHeader
                        title="Upcoming sessions"
                        description={upcoming.length > 0 ? `Next ${pluralize(upcoming.length, "session")}` : undefined}
                        icon={<CalendarClock />}
                        as="h3"
                        action={<CardLink href={hrefWith(routes.coach.sessions, {}, { fighter: fighter.id })}>Calendar</CardLink>}
                    />
                    {upcoming.length === 0 ? (
                        <CardContent>
                            <EmptyState
                                compact
                                icon={<CalendarClock />}
                                title="Nothing scheduled"
                                description={`Schedule ${firstName}'s next session — it's checked against their Medical Clearance.`}
                                action={
                                    <ButtonLink href={scheduleHref} variant="secondary" size="sm">
                                        Schedule session
                                    </ButtonLink>
                                }
                            />
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <UpcomingByDay sessions={upcoming} now={now} audience="coach" coachNames={coachNames} headingLevel={4} />
                        </div>
                    )}
                </Card>
                <AdherenceChart
                    weeks={adherenceWeeks}
                    description={activePlan ? "Completed out of due sessions per week in the active plan" : `Completed out of due sessions per week, last ${ADHERENCE_WEEKS} weeks`}
                    headingAs="h3"
                    className="min-w-0"
                />
            </div>

            <Card className="overflow-hidden">
                <CardHeader
                    title="Recent history"
                    description="Latest completed, missed and cancelled sessions"
                    icon={<History />}
                    as="h3"
                    action={<CardLink href={hrefWith(routes.coach.sessions, {}, { view: "list", fighter: fighter.id })}>All sessions</CardLink>}
                />
                {history.length === 0 ? (
                    <CardContent>
                        <EmptyState compact icon={<History />} title="No past sessions yet" description="Completed, missed and cancelled sessions appear here." />
                    </CardContent>
                ) : (
                    <div className="border-t border-border">
                        <SessionTable sessions={history} audience="coach" caption={`Recent sessions for ${fighter.name}`} showVideo stackOnMobile />
                    </div>
                )}
            </Card>
        </section>
    );
}
