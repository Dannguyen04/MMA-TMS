import { getDemoCopy } from "@/lib/i18n/server";
import type { Metadata } from "next";

import { scopedFighterIds } from "@/components/dashboard/roster-data";
import { PageHeader } from "@/components/ui/page-header";
import { PlanForm, type PlanFormValues } from "@/components/training/plan-form";
import { getClearanceSummaries, toFighterOption } from "@/components/training/training-data";
import { requireRole } from "@/lib/auth/session";
import { createPlan } from "@/lib/actions/training";
import { addDaysToKey, dayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> { const copy = await getDemoCopy(); return { title: copy("New training plan") }; }

const DEFAULT_PLAN_WEEKS = 8;

export default async function NewPlanPage({ searchParams }: PageProps<"/coach/training-plans/new">) {
    const copy = await getDemoCopy();
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();
    const fighterList = listFighters(user);
    const [fighters, clearances] = await Promise.all([fighterList, getClearanceSummaries(scopedFighterIds(user, fighterList), now)]);

    const requested = param(params.fighter);
    const prefilled = fighters.find((f) => f.id === requested);
    const serviceForm = usesTrainingServiceForms();
    const today = dayKey(now);
    const defaults: PlanFormValues = {
        fighterId: prefilled?.id ?? "",
        title: "",
        objective: "",
        phase: "build",
        focusAreas: [],
        startDate: today,
        endDate: addDaysToKey(today, DEFAULT_PLAN_WEEKS * 7 - 1),
        weeklySessionTarget: "5",
        status: "draft",
        notes: "",
    };

    return (
        <>
            <PageHeader
                title={copy("New training plan")}
                description={copy(serviceForm ? "Set the objective, phase and dates. Check the fighter’s Medical Clearance before planning." : "Set the objective, phase and weekly target. Check the fighter’s Medical Clearance before planning.")}
                back={prefilled ? { href: routes.coach.fighterTraining(prefilled.id), label: prefilled.name } : { href: routes.coach.plans, label: copy("Training plans") }}
            />
            <PlanForm
                mode="create"
                action={createPlan}
                fighters={fighters.map(toFighterOption)}
                clearances={clearances}
                defaults={defaults}
                now={now}
                cancelHref={prefilled ? routes.coach.fighterTraining(prefilled.id) : routes.coach.plans}
                serviceForm={serviceForm}
            />
        </>
    );
}
