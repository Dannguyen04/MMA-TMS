import { CalendarPlus, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ClearanceCard } from "@/components/domain/clearance-card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PlanOverview } from "@/components/training/plan-overview";
import { PlanSessionsCard, PlanStatsCard } from "@/components/training/plan-sessions";
import { PlanStatusActions } from "@/components/training/plan-status-actions";
import { AdherenceChart } from "@/components/training/training-charts";
import { getClearanceSummaries, getCoachNames, toIdentity } from "@/components/training/training-data";
import { planAdherence, planAdherenceWeeks } from "@/components/training/training-utils";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getPlanWithSessions } from "@/lib/services/training";

/** One plan read per request, shared by the metadata and the page. */
const loadPlan = cache(getPlanWithSessions);

export async function generateMetadata({ params }: PageProps<"/coach/training-plans/[planId]">): Promise<Metadata> {
    const [{ planId }, user] = await Promise.all([params, getCurrentUser()]);
    const data = await loadPlan(planId);
    return { title: data && user && canAccessFighter(user, data.plan.fighterId) ? data.plan.title : "Training plan" };
}

export default async function CoachPlanPage({ params, searchParams }: PageProps<"/coach/training-plans/[planId]">) {
    const user = await requireRole("coach");
    const [{ planId }, query] = await Promise.all([params, searchParams]);
    const now = new Date().toISOString();

    // Coach names and the clearance lookup start with the plan read; clearance is only read for a fighter this coach may see.
    const planRead = loadPlan(planId);
    const [data, coachNames, clearances] = await Promise.all([
        planRead,
        getCoachNames(),
        getClearanceSummaries(
            planRead.then((result) => (result && canAccessFighter(user, result.plan.fighterId) ? [result.plan.fighterId] : [])),
            now,
        ),
    ]);
    if (!data) notFound();
    const fighter = requireFighterAccess(user, data.plan.fighterId);

    const { plan, sessions } = data;
    const clearance = clearances[fighter.id];
    const canSchedule = plan.status === "active" || plan.status === "draft";
    const scheduleHref = hrefWith(routes.coach.newSession, {}, { fighter: fighter.id, plan: plan.id });

    return (
        <>
            <PageHeader
                eyebrow="Training plan"
                title={plan.title}
                back={{ href: routes.coach.plans, label: "Training plans" }}
                actions={
                    <>
                        <ButtonLink href={routes.coach.editPlan(plan.id)} variant="secondary">
                            <PenLine aria-hidden />
                            Edit
                        </ButtonLink>
                        {canSchedule && (
                            <ButtonLink href={scheduleHref}>
                                <CalendarPlus aria-hidden />
                                Schedule session
                            </ButtonLink>
                        )}
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <PlanOverview
                    plan={plan}
                    now={now}
                    fighter={toIdentity(fighter)}
                    fighterHref={routes.coach.fighter(fighter.id)}
                    coachName={coachNames[plan.coachId]}
                    adherence={planAdherence(sessions, now)}
                    showNotes
                    actions={<PlanStatusActions planId={plan.id} status={plan.status} planTitle={plan.title} fighterName={fighter.name} />}
                />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <AdherenceChart
                        weeks={planAdherenceWeeks(plan, sessions, now)}
                        description="Completed out of due sessions per week in this plan"
                        className="min-w-0 lg:col-span-2"
                    />
                    <div className="flex min-w-0 flex-col gap-6">
                        <PlanStatsCard sessions={sessions} now={now} />
                        <ClearanceCard clearance={clearance.clearance} state={clearance.state} doctorName={clearance.doctorName} now={now} variant="summary" />
                    </div>
                </div>
                <PlanSessionsCard
                    sessions={sessions}
                    audience="coach"
                    now={now}
                    pathname={routes.coach.plan(plan.id)}
                    searchParams={query}
                    upcomingHref={hrefWith(routes.coach.sessions, {}, { fighter: fighter.id })}
                    emptyAction={
                        canSchedule ? (
                            <ButtonLink href={scheduleHref} variant="secondary" size="sm">
                                <CalendarPlus aria-hidden />
                                Schedule session
                            </ButtonLink>
                        ) : undefined
                    }
                />
            </div>
        </>
    );
}
