import { Bandage } from "lucide-react";
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
import { getTranslator } from "@/lib/i18n/server";
import { param } from "@/lib/utils";

/** The recovery-plan form, on its own page or inside the fighter's profile (where `fighter` is that fighter). */
export async function NewRecoveryView(props: { query: Record<string, string | string[] | undefined> }) {
    if (usesMedicalServiceForms()) return <NewMilestonePlan {...props} />;
    const user = await requireRole("doctor");
    const { t } = await getTranslator();
    const params = props.query;
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
        .filter((injury) => injury.status !== "resolved" && !injuriesWithPlan.has(injury.id) && (!param(params.fighter) || injury.fighterId === param(params.fighter)))
        .flatMap((injury) => {
            const fighterName = fighterNames.get(injury.fighterId);
            return fighterName ? [{ injury, fighterName }] : [];
        });

    const requestedInjuryId = param(params.injury) ?? "";
    const requested = options.find((option) => option.injury.id === requestedInjuryId);
    const existingPlan = requestedInjuryId ? plans.find((plan) => plan.injuryId === requestedInjuryId && plan.status !== "completed") : undefined;
    const back = requested
        ? { href: routes.doctor.fighterInjury(requested.injury.fighterId, requested.injury.id), label: t("doctorViews.injury.eyebrow") }
        : { href: routes.doctor.recovery, label: t("doctorViews.history.kind.plan") };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow={t("doctorViews.injury.plan")}
                title={t("doctorViews.newRecovery.title")}
                description={t("doctorViews.newRecovery.description")}
            />
            {options.length === 0 ? (
                <EmptyState
                    icon={<Bandage />}
                    title={t("doctorViews.newRecovery.noneTitle")}
                    description={
                        existingPlan
                            ? t("doctorViews.newRecovery.noneExisting")
                            : t("doctorViews.newRecovery.noneAll")
                    }
                    action={
                        <>
                            {existingPlan ? (
                                <ButtonLink href={routes.doctor.fighterRecoveryPlan(existingPlan.fighterId, existingPlan.id)} variant="secondary">
                                    {t("doctorViews.newRecovery.openPlan", { title: existingPlan.title })}
                                </ButtonLink>
                            ) : (
                                <ButtonLink href={routes.doctor.recovery} variant="secondary">
                                    {t("doctorViews.newRecovery.viewPlans")}
                                </ButtonLink>
                            )}
                            <ButtonLink href={clinicalLinks.newInjuryFor({})}>{t("doctorViews.injuries.new")}</ButtonLink>
                        </>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {existingPlan && (
                        <p role="status" className="rounded-lg bg-info-soft px-4 py-3 text-sm text-info-fg ring-1 ring-inset ring-info-border">
                            {t("doctorViews.newRecovery.runningLead")}{" "}
                            <Link href={routes.doctor.fighterRecoveryPlan(existingPlan.fighterId, existingPlan.id)} className="font-medium underline">
                                {t("doctorViews.newRecovery.runningLink", { title: existingPlan.title })}
                            </Link>
                            {t("doctorViews.newRecovery.runningTail")}
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
async function NewMilestonePlan({ query: params }: { query: Record<string, string | string[] | undefined> }) {
    const user = await requireRole("doctor");
    const { t } = await getTranslator();
    const now = new Date().toISOString();
    const { fighters, fighter, dossier } = await loadFormFighter(user, param(params.fighter));
    const planned = new Set(dossier?.activeRecoveryPlans.map((plan) => plan.injuryId) ?? []);
    const injuries = dossier?.activeInjuries.filter((injury) => !planned.has(injury.id)) ?? [];
    const requestedInjury = param(params.injury) ?? "";
    const existingPlan = dossier?.activeRecoveryPlans.find((plan) => plan.injuryId === requestedInjury);
    const back = fighter ? { href: requestedInjury ? routes.doctor.injury(requestedInjury) : routes.doctor.fighter(fighter.id), label: requestedInjury ? t("doctorViews.injury.eyebrow") : fighter.name } : { href: routes.doctor.recovery, label: t("doctorViews.history.kind.plan") };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow={t("doctorViews.injury.plan")}
                title={fighter ? t("doctorViews.newRecovery.titleFor", { name: fighter.name }) : t("doctorViews.newRecovery.title")}
                description={t("doctorViews.newRecovery.descriptionMilestones")}
            />
            {!fighter || !dossier ? (
                <FighterChooser
                    fighters={fighters}
                    hrefFor={(fighterId) => hrefWith(clinicalLinks.newRecoveryPlan, {}, { fighter: fighterId })}
                    title={t("doctorViews.newRecovery.chooserTitle")}
                    unreadable={fighter}
                />
            ) : injuries.length === 0 ? (
                <EmptyState
                    icon={<Bandage />}
                    title={existingPlan ? t("doctorViews.newRecovery.runningTitle") : t("doctorViews.newRecovery.noneTitleService")}
                    description={
                        existingPlan
                            ? t("doctorViews.newRecovery.openToTrack", { title: existingPlan.title })
                            : t("doctorViews.newRecovery.noneFighter", { name: fighter.name })
                    }
                    action={
                        existingPlan ? (
                            <ButtonLink href={routes.doctor.fighterRecoveryPlan(existingPlan.fighterId, existingPlan.id)} variant="secondary">
                                {t("doctorViews.newRecovery.openPlan", { title: existingPlan.title })}
                            </ButtonLink>
                        ) : (
                            <ButtonLink href={clinicalLinks.newInjuryFor({ fighterId: fighter.id })}>{t("doctorViews.injuries.new")}</ButtonLink>
                        )
                    }
                />
            ) : (
                <MilestonePlanForm fighter={{ id: fighter.id, name: fighter.name }} injuries={injuries} defaultInjuryId={requestedInjury} today={dayKey(now)} cancelHref={back.href} />
            )}
        </>
    );
}
