import { Bandage } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { clinicalLinks } from "@/components/clinical/clinical-links";
import { MilestonePlanForm } from "@/components/clinical/milestone-plan-form";
import { FighterChooser } from "@/components/medical/fighter-chooser";
import { loadFormFighter } from "@/components/medical/form-fighter";
import { RecoveryPlanForm, type RecoveryInjuryOption } from "@/components/clinical/recovery-plan-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listInjuries, listRecoveryPlans } from "@/lib/services/medical";
import { usesMedicalServiceForms } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "New recovery plan" };

export default async function NewRecoveryPlanPage(props: PageProps<"/doctor/recovery/new">) {
    if (usesMedicalServiceForms()) return <NewMilestonePlanPage {...props} />;
    const { searchParams } = props;
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const [fighters, injuries, plans] = await Promise.all([
        listFighters(user),
        listInjuries({ fighterIds: scope }),
        listRecoveryPlans({ fighterIds: scope }),
    ]);
    const fighterNames = new Map(fighters.map((fighter) => [fighter.id, fighter.name]));
    const injuriesWithPlan = new Set(plans.filter((plan) => plan.status !== "completed").map((plan) => plan.injuryId));

    const options: RecoveryInjuryOption[] = injuries
        .filter((injury) => injury.status !== "resolved" && !injuriesWithPlan.has(injury.id))
        .flatMap((injury) => {
            const fighterName = fighterNames.get(injury.fighterId);
            return fighterName ? [{ injury, fighterName }] : [];
        });

    const requestedInjuryId = param(params.injury) ?? "";
    const requested = options.find((option) => option.injury.id === requestedInjuryId);
    const existingPlan = requestedInjuryId ? plans.find((plan) => plan.injuryId === requestedInjuryId && plan.status !== "completed") : undefined;
    const back = requested
        ? { href: routes.doctor.injury(requested.injury.id), label: "Injury record" }
        : { href: routes.doctor.recovery, label: "Recovery" };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow="Recovery plan"
                title="New recovery plan"
                description="Plan the return to training in phases. Each phase has a goal and milestones you tick off as the fighter progresses."
            />
            {options.length === 0 ? (
                <EmptyState
                    icon={<Bandage />}
                    title="No injuries need a recovery plan"
                    description={
                        existingPlan
                            ? "That injury already has a recovery plan in progress, and every other open injury of your assigned fighters has one too."
                            : "Every open injury of your assigned fighters already has a plan in progress. Record an injury first to plan its recovery."
                    }
                    action={
                        <>
                            {existingPlan ? (
                                <ButtonLink href={routes.doctor.recoveryPlan(existingPlan.id)} variant="secondary">
                                    Open “{existingPlan.title}”
                                </ButtonLink>
                            ) : (
                                <ButtonLink href={routes.doctor.recovery} variant="secondary">
                                    View recovery plans
                                </ButtonLink>
                            )}
                            <ButtonLink href={clinicalLinks.newInjuryFor({})}>Record injury</ButtonLink>
                        </>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {existingPlan && (
                        <p role="status" className="rounded-lg bg-info-soft px-4 py-3 text-sm text-info-fg ring-1 ring-inset ring-info-border">
                            That injury already has a recovery plan in progress —{" "}
                            <Link href={routes.doctor.recoveryPlan(existingPlan.id)} className="font-medium underline">
                                open “{existingPlan.title}”
                            </Link>
                            . Choose another injury below.
                        </p>
                    )}
                    <RecoveryPlanForm
                        injuries={options}
                        defaultInjuryId={requested?.injury.id ?? ""}
                        today={dayKey(now)}
                        now={now}
                        cancelHref={back.href}
                    />
                </div>
            )}
        </>
    );
}

/** API mode: a milestone plan for one of the chosen fighter's open injuries, from that fighter's dossier only. */
async function NewMilestonePlanPage({ searchParams }: PageProps<"/doctor/recovery/new">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const { fighters, fighter, dossier } = await loadFormFighter(user, param(params.fighter));
    const planned = new Set(dossier?.activeRecoveryPlans.map((plan) => plan.injuryId) ?? []);
    const injuries = dossier?.activeInjuries.filter((injury) => !planned.has(injury.id)) ?? [];
    const requestedInjury = param(params.injury) ?? "";
    const existingPlan = dossier?.activeRecoveryPlans.find((plan) => plan.injuryId === requestedInjury);
    const back = fighter ? { href: requestedInjury ? routes.doctor.injury(requestedInjury) : routes.doctor.fighter(fighter.id), label: requestedInjury ? "Injury record" : fighter.name } : { href: routes.doctor.recovery, label: "Recovery" };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow="Recovery plan"
                title={fighter ? `Recovery plan for ${fighter.name}` : "New recovery plan"}
                description="Plan the return to training as milestones, each with how you'll know it's reached."
            />
            {!fighter || !dossier ? (
                <FighterChooser
                    fighters={fighters}
                    hrefFor={(fighterId) => hrefWith(clinicalLinks.newRecoveryPlan, {}, { fighter: fighterId })}
                    title="Whose recovery is this?"
                    unreadable={fighter}
                />
            ) : injuries.length === 0 ? (
                <EmptyState
                    icon={<Bandage />}
                    title={existingPlan ? "That injury already has a plan in progress" : "No injury needs a recovery plan"}
                    description={
                        existingPlan
                            ? `Open “${existingPlan.title}” to track its milestones.`
                            : `Every open injury of ${fighter.name} already has a plan in progress. Record an injury first to plan its recovery.`
                    }
                    action={
                        existingPlan ? (
                            <ButtonLink href={routes.doctor.recoveryPlan(existingPlan.id)} variant="secondary">
                                Open “{existingPlan.title}”
                            </ButtonLink>
                        ) : (
                            <ButtonLink href={clinicalLinks.newInjuryFor({ fighterId: fighter.id })}>Record injury</ButtonLink>
                        )
                    }
                />
            ) : (
                <MilestonePlanForm fighter={{ id: fighter.id, name: fighter.name }} injuries={injuries} defaultInjuryId={requestedInjury} today={dayKey(now)} cancelHref={back.href} />
            )}
        </>
    );
}
