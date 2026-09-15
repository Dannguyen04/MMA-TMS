import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { PlanOverview } from "@/components/training/plan-overview";
import { PlanSessionsCard, PlanStatsCard } from "@/components/training/plan-sessions";
import { AdherenceChart } from "@/components/training/training-charts";
import { getCoachNames } from "@/components/training/training-data";
import { planAdherence, planAdherenceWeeks } from "@/components/training/training-utils";
import { requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import type { TrainingPlan, User } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getPlanWithSessions } from "@/lib/services/training";

/** One plan read per request, shared by the metadata and the page. */
const loadPlan = cache(getPlanWithSessions);

/** Fighters see their own plans once the coach has published them. */
function isVisibleTo(plan: TrainingPlan, user: User): boolean {
    return user.role === "fighter" && plan.fighterId === user.profileId && plan.status !== "draft";
}

export async function generateMetadata({ params }: PageProps<"/fighter/training/plans/[planId]">): Promise<Metadata> {
    const [{ planId }, user] = await Promise.all([params, getCurrentUser()]);
    const data = await loadPlan(planId);
    return { title: data && user && isVisibleTo(data.plan, user) ? data.plan.title : "Training plan" };
}

export default async function FighterPlanPage({ params, searchParams }: PageProps<"/fighter/training/plans/[planId]">) {
    const user = await requireRole("fighter");
    const [{ planId }, query] = await Promise.all([params, searchParams]);
    const [data, coachNames] = await Promise.all([loadPlan(planId), getCoachNames()]);
    if (!data || !isVisibleTo(data.plan, user)) notFound();
    requireFighterAccess(user, data.plan.fighterId);

    const { plan, sessions } = data;
    const now = new Date().toISOString();

    return (
        <>
            <PageHeader eyebrow="Training plan" title={plan.title} back={{ href: routes.fighter.training, label: "Training plans" }} />

            <div className="flex flex-col gap-6">
                <PlanOverview plan={plan} now={now} coachName={coachNames[plan.coachId]} adherence={planAdherence(sessions, now)} showNotes />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <AdherenceChart
                        weeks={planAdherenceWeeks(plan, sessions, now)}
                        description="Completed out of due sessions per week in this plan"
                        className="min-w-0 lg:col-span-2"
                    />
                    <PlanStatsCard sessions={sessions} now={now} />
                </div>
                <PlanSessionsCard
                    sessions={sessions}
                    audience="fighter"
                    now={now}
                    pathname={routes.fighter.plan(plan.id)}
                    searchParams={query}
                    upcomingHref={routes.fighter.schedule}
                />
            </div>
        </>
    );
}
