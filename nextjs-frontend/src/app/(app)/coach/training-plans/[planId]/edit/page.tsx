import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { PlanForm, type PlanFormValues } from "@/components/training/plan-form";
import { getClearanceSummaries, toFighterOption } from "@/components/training/training-data";
import { updatePlan } from "@/lib/actions/training";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getPlan } from "@/lib/services/training";

/** One plan read per request, shared by the metadata and the page. */
const loadPlan = cache(getPlan);

export async function generateMetadata({ params }: PageProps<"/coach/training-plans/[planId]/edit">): Promise<Metadata> {
    const [{ planId }, user] = await Promise.all([params, getCurrentUser()]);
    const plan = await loadPlan(planId);
    return { title: plan && user && canAccessFighter(user, plan.fighterId) ? `Edit ${plan.title}` : "Edit training plan" };
}

export default async function EditPlanPage({ params }: PageProps<"/coach/training-plans/[planId]/edit">) {
    const user = await requireRole("coach");
    const { planId } = await params;
    const now = new Date().toISOString();
    // The clearance lookup starts with the plan read and only covers a fighter this coach may see.
    const planRead = loadPlan(planId);
    const [plan, clearances] = await Promise.all([
        planRead,
        getClearanceSummaries(planRead.then((result) => (result && canAccessFighter(user, result.fighterId) ? [result.fighterId] : [])), now),
    ]);
    if (!plan) notFound();
    const fighter = await requireFighterAccess(user, plan.fighterId);

    const defaults: PlanFormValues = {
        fighterId: fighter.id,
        title: plan.title,
        objective: plan.objective,
        phase: plan.phase,
        focusAreas: plan.focusAreas,
        startDate: dayKey(plan.startDate),
        endDate: dayKey(plan.endDate),
        weeklySessionTarget: String(plan.weeklySessionTarget),
        status: plan.status === "active" ? "active" : "draft",
        notes: plan.notes,
    };

    return (
        <>
            <PageHeader
                eyebrow="Edit training plan"
                title={plan.title}
                description={plan.status === "active" ? `${fighter.name} is notified when you save changes to an active plan.` : undefined}
                back={{ href: routes.coach.plan(plan.id), label: "Back to plan" }}
            />
            <PlanForm
                mode="edit"
                action={updatePlan.bind(null, plan.id)}
                fighters={[toFighterOption(fighter)]}
                clearances={clearances}
                defaults={defaults}
                now={now}
                cancelHref={routes.coach.plan(plan.id)}
            />
        </>
    );
}
