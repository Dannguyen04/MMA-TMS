import { CalendarPlus, Copy, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ClearanceCard } from "@/components/domain/clearance-card";
import { FlashToast } from "@/components/medical/flash-toast";
import type { ToastInput } from "@/components/ui/toast";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PlanExercisesCard } from "@/components/training/plan-exercises";
import { PlanOverview } from "@/components/training/plan-overview";
import { PlanSessionsCard, PlanStatsCard } from "@/components/training/plan-sessions";
import { PlanStatusActions } from "@/components/training/plan-status-actions";
import { AdherenceChart } from "@/components/training/training-charts";
import { getClearanceSummaries, getCoachNames, toIdentity } from "@/components/training/training-data";
import { planAdherence, planAdherenceWeeks } from "@/components/training/training-utils";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { planTransitions } from "@/lib/domain/training-plan";
import { pluralize } from "@/lib/format";
import { hrefWith, type SearchParams } from "@/lib/query";
import { routes } from "@/lib/routes";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { getPlanWithSessions, listExercises, listPlanExercises } from "@/lib/services/training";
import { param } from "@/lib/utils";

/** One plan read per request, shared by the metadata and the page. */
const loadPlan = cache(getPlanWithSessions);

/** The toast after creating a plan (`?notice=` from `createPlan`), or null. */
function planNotice(query: SearchParams): ToastInput | null {
    const notice = param(query.notice);
    const failed = Math.max(1, Math.floor(Number(param(query.failed)) || 1));
    const exercises = pluralize(failed, "exercise");
    switch (notice) {
        case "not-activated":
            return { title: "Plan saved as a draft", description: "It couldn't be activated. Activate it from this page.", tone: "warning" };
        case "exercises-failed":
            return { title: "Plan created", description: `${exercises} couldn't be added. Add ${failed === 1 ? "it" : "them"} from the exercise list.`, tone: "warning" };
        case "exercises-failed-draft":
            return {
                title: "Plan saved as a draft",
                description: `${exercises} couldn't be added, so the plan wasn't activated. Add ${failed === 1 ? "it" : "them"}, then activate the plan.`,
                tone: "warning",
            };
        default:
            return null;
    }
}

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
    const fighter = await requireFighterAccess(user, data.plan.fighterId);
    const [planExercises, library] = await Promise.all([listPlanExercises(data.plan.id), listExercises()]);

    const { plan, sessions } = data;
    const clearance = clearances[fighter.id];
    const canSchedule = plan.status === "active" || plan.status === "draft";
    const scheduleHref = hrefWith(routes.coach.newSession, {}, { fighter: fighter.id, plan: plan.id });

    return (
        <>
            <FlashToast notice={planNotice(query)} cleanHref={routes.coach.plan(plan.id)} />
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
                        <ButtonLink href={hrefWith(routes.coach.newPlan, {}, { from: plan.id })} variant="secondary">
                            <Copy aria-hidden />
                            Duplicate
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
                    actions={
                        <PlanStatusActions
                            planId={plan.id}
                            transitions={planTransitions(plan.status, { restoreArchived: !usesTrainingServiceForms() })}
                            planTitle={plan.title}
                            fighterName={fighter.name}
                        />
                    }
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
                <PlanExercisesCard planId={plan.id} items={planExercises} library={library} editable={canSchedule} />
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
