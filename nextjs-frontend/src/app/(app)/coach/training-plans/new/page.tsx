import { getDemoCopy } from "@/lib/i18n/server";
import type { Metadata } from "next";

import { scopedFighterIds } from "@/components/dashboard/roster-data";
import { PageHeader } from "@/components/ui/page-header";
import { PlanCreateForm, type CopyablePlan, type PlanCreateValues, type PlanSource } from "@/components/training/plan-create-form";
import { planCopyFrom, type PlanCopy } from "@/components/training/plan-drafts";
import { getClearanceSummaries, toFighterOption } from "@/components/training/training-data";
import { createPlan } from "@/lib/actions/training";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { planEndKey, planTemplate, planWholeWeeks } from "@/lib/domain/training-templates";
import { addDaysToKey, dayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { usesTrainingServiceForms } from "@/lib/services/platform-features";
import { listExercises, listPlanExercises, listPlans } from "@/lib/services/training";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> { const copy = await getDemoCopy(); return { title: copy("New training plan") }; }

const DEFAULT_PLAN_WEEKS = 8;

export default async function NewPlanPage({ searchParams }: PageProps<"/coach/training-plans/new">) {
    const demoCopy = await getDemoCopy();
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();
    const today = dayKey(now);
    const fighterList = listFighters(user);
    const [fighters, clearances, library, plans] = await Promise.all([
        fighterList,
        getClearanceSummaries(scopedFighterIds(user, fighterList), now),
        listExercises(),
        listPlans({ fighterIds: accessibleFighterIds(user) }),
    ]);

    // ?from= copies a plan on this coach's roster; ?template= starts from a template; ?fighter= picks the fighter.
    const source = plans.find((plan) => plan.id === param(params.from));
    const copy: PlanCopy | null = source ? planCopyFrom(source, await listPlanExercises(source.id)) : null;
    const template = copy ? undefined : planTemplate(param(params.template));
    const requested = fighters.find((fighter) => fighter.id === param(params.fighter));
    const fighter = requested ?? (source ? fighters.find((candidate) => candidate.id === source.fighterId) : undefined);

    const initialSource: PlanSource = copy ? { kind: "copy", planId: copy.planId } : template ? { kind: "template", id: template.id } : { kind: "blank" };
    const defaults: PlanCreateValues = {
        fighterId: fighter?.id ?? "",
        title: copy?.title ?? template?.label ?? "",
        phase: copy?.phase ?? template?.phase ?? "build",
        startDate: today,
        endDate: copy?.days ? addDaysToKey(today, copy.days - 1) : planEndKey(today, template?.weeks ?? DEFAULT_PLAN_WEEKS),
        objective: copy?.objective ?? template?.objective ?? "",
        notes: copy?.notes ?? template?.notes ?? "",
        focusAreas: source?.focusAreas ?? [],
        weeklySessionTarget: source?.weeklySessionTarget ? String(source.weeklySessionTarget) : "5",
        status: "draft",
    };

    const fighterName = new Map(fighters.map((option) => [option.id, option.name]));
    const copyablePlans: CopyablePlan[] = plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        fighterName: fighterName.get(plan.fighterId) ?? "Fighter",
        phase: plan.phase,
        status: plan.status,
        weeks: plan.endDate ? planWholeWeeks(dayKey(plan.startDate), dayKey(plan.endDate)) : null,
    }));
    const back = source
        ? { href: routes.coach.plan(source.id), label: source.title }
        : fighter
          ? { href: routes.coach.fighterTraining(fighter.id), label: fighter.name }
          : { href: routes.coach.plans, label: demoCopy("Training plans") };

    return (
        <>
            <PageHeader
                title={demoCopy("New training plan")}
                description={demoCopy("Start from a template, a blank plan or a copy of one you've run. Check the fighter's Medical Clearance so the plan fits their restrictions.")}
                back={back}
            />
            <PlanCreateForm
                action={createPlan}
                fighters={fighters.map(toFighterOption)}
                clearances={clearances}
                library={library}
                copyablePlans={copyablePlans}
                initialSource={initialSource}
                initialCopy={copy}
                defaults={defaults}
                now={now}
                today={today}
                cancelHref={back.href}
                serviceForm={usesTrainingServiceForms()}
            />
        </>
    );
}
