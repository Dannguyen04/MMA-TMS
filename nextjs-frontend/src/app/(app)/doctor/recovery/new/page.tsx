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

export const metadata: Metadata = { title: "Kế hoạch phục hồi mới" };

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
        ? { href: routes.doctor.injury(requested.injury.id), label: "Hồ sơ chấn thương" }
        : { href: routes.doctor.recovery, label: "Phục hồi" };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow="Kế hoạch phục hồi"
                title="Kế hoạch phục hồi mới"
                description="Lập kế hoạch trở lại tập theo giai đoạn, mỗi giai đoạn có mục tiêu và các mốc."
            />
            {options.length === 0 ? (
                <EmptyState
                    icon={<Bandage />}
                    title="Không có chấn thương cần kế hoạch"
                    description={
                        existingPlan
                            ? "Chấn thương đó đã có kế hoạch phục hồi đang chạy, và mọi chấn thương đang mở khác của võ sĩ bạn phụ trách cũng vậy."
                            : "Mọi chấn thương đang mở của võ sĩ bạn phụ trách đều đã có kế hoạch. Hãy ghi chấn thương trước rồi lập kế hoạch phục hồi."
                    }
                    action={
                        <>
                            {existingPlan ? (
                                <ButtonLink href={routes.doctor.recoveryPlan(existingPlan.id)} variant="secondary">
                                    Mở “{existingPlan.title}”
                                </ButtonLink>
                            ) : (
                                <ButtonLink href={routes.doctor.recovery} variant="secondary">
                                    Xem kế hoạch phục hồi
                                </ButtonLink>
                            )}
                            <ButtonLink href={clinicalLinks.newInjuryFor({})}>Ghi nhận chấn thương</ButtonLink>
                        </>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {existingPlan && (
                        <p role="status" className="rounded-lg bg-info-soft px-4 py-3 text-sm text-info-fg ring-1 ring-inset ring-info-border">
                            Chấn thương đó đã có kế hoạch phục hồi đang chạy —{" "}
                            <Link href={routes.doctor.recoveryPlan(existingPlan.id)} className="font-medium underline">
                                mở “{existingPlan.title}”
                            </Link>
                            . Hãy chọn chấn thương khác bên dưới.
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
    const back = fighter ? { href: requestedInjury ? routes.doctor.injury(requestedInjury) : routes.doctor.fighter(fighter.id), label: requestedInjury ? "Hồ sơ chấn thương" : fighter.name } : { href: routes.doctor.recovery, label: "Phục hồi" };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow="Kế hoạch phục hồi"
                title={fighter ? `Kế hoạch phục hồi cho ${fighter.name}` : "Kế hoạch phục hồi mới"}
                description="Lập kế hoạch trở lại tập theo các mốc, mỗi mốc có tiêu chí đạt."
            />
            {!fighter || !dossier ? (
                <FighterChooser
                    fighters={fighters}
                    hrefFor={(fighterId) => hrefWith(clinicalLinks.newRecoveryPlan, {}, { fighter: fighterId })}
                    title="Kế hoạch phục hồi cho võ sĩ nào?"
                    unreadable={fighter}
                />
            ) : injuries.length === 0 ? (
                <EmptyState
                    icon={<Bandage />}
                    title={existingPlan ? "Chấn thương đó đã có kế hoạch đang chạy" : "Không có chấn thương nào cần kế hoạch phục hồi"}
                    description={
                        existingPlan
                            ? `Mở “${existingPlan.title}” để theo dõi các mốc.`
                            : `Mọi chấn thương đang mở của ${fighter.name} đã có kế hoạch. Hãy ghi chấn thương trước.`
                    }
                    action={
                        existingPlan ? (
                            <ButtonLink href={routes.doctor.recoveryPlan(existingPlan.id)} variant="secondary">
                                Mở “{existingPlan.title}”
                            </ButtonLink>
                        ) : (
                            <ButtonLink href={clinicalLinks.newInjuryFor({ fighterId: fighter.id })}>Ghi nhận chấn thương</ButtonLink>
                        )
                    }
                />
            ) : (
                <MilestonePlanForm fighter={{ id: fighter.id, name: fighter.name }} injuries={injuries} defaultInjuryId={requestedInjury} today={dayKey(now)} cancelHref={back.href} />
            )}
        </>
    );
}
