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
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { getPlan } from "@/lib/services/training";

/** One plan read per request, shared by the metadata and the page. */
const loadPlan = cache(getPlan);

export async function generateMetadata({ params }: PageProps<"/coach/training-plans/[planId]/edit">): Promise<Metadata> {
    const [{ planId }, user, { t }] = await Promise.all([params, getCurrentUser(), getTranslator()]);
    const plan = await loadPlan(planId);
    return { title: plan && user && canAccessFighter(user, plan.fighterId) ? `${t("training.planForm.titleEdit")} ${plan.title}` : t("training.planForm.titleEdit") };
}

export default async function EditPlanPage({ params }: PageProps<"/coach/training-plans/[planId]/edit">) {
    const user = await requireRole("coach");
    const [{ planId }, { t }] = await Promise.all([params, getTranslator()]);
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
        endDate: plan.endDate === null ? "" : dayKey(plan.endDate),
        weeklySessionTarget: plan.weeklySessionTarget === null ? "" : String(plan.weeklySessionTarget),
        status: plan.status === "active" ? "active" : "draft",
        notes: plan.notes,
    };

    return (
        <>
            <PageHeader
                eyebrow={t("training.planForm.titleEdit")}
                title={plan.title}
                description={plan.status === "active" ? t("training.planForm.descEditActive", { name: fighter.name }) : undefined}
                back={{ href: routes.coach.plan(plan.id), label: t("training.planDetails.backToPlan") }}
            />
            <PlanForm
                mode="edit"
                action={updatePlan.bind(null, plan.id)}
                fighters={[toFighterOption(fighter)]}
                clearances={clearances}
                defaults={defaults}
                now={now}
                cancelHref={routes.coach.plan(plan.id)}
                serviceForm={usesTrainingServiceForms()}
            />
        </>
    );
}
