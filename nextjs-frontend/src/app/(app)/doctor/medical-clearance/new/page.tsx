import { CircleCheck, ClipboardPlus, ShieldQuestion } from "lucide-react";
import type { Metadata } from "next";

import { FighterChooser } from "@/components/medical/fighter-chooser";
import { loadFormFighter } from "@/components/medical/form-fighter";
import { GrantClearanceForm, type ClearanceFighterContext } from "@/components/medical/grant-clearance-form";
import { IssueClearanceForm } from "@/components/medical/issue-clearance-form";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { BODY_REGION_LABELS, INJURY_STATUS_LABELS, injuryTypeName } from "@/lib/domain/labels";
import { clearanceState, currentClearance } from "@/lib/domain/rules";
import { dayKey } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { listClearances, listExaminations, listInjuries, type CurrentExamination } from "@/lib/services/medical";
import { usesMedicalServiceForms } from "@/lib/services/medical-features";
import { listDoctors, listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Update Medical Clearance" };

/** Recent examinations offered as evidence for the decision. */
const EXAMINATION_OPTIONS = 8;

export default async function GrantClearancePage(props: PageProps<"/doctor/medical-clearance/new">) {
    if (usesMedicalServiceForms()) return <IssueClearancePage {...props} />;
    const { searchParams } = props;
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const [assigned, examinations, injuries, doctors, settings, clearances] = await Promise.all([
        listFighters(user),
        listExaminations({ fighterIds: scope }),
        listInjuries({ fighterIds: scope }),
        listDoctors(),
        getSettings(),
        listClearances({ fighterIds: scope }),
    ]);
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

    const fighters: ClearanceFighterContext[] = assigned
        .map((fighter) => ({ fighter, clearance: currentClearance(clearances, fighter.id) }))
        .map(({ fighter, clearance }) => ({
            id: fighter.id,
            name: fighter.name,
            nickname: fighter.nickname,
            weightClass: fighter.weightClass,
            stance: fighter.stance,
            level: fighter.level,
            healthStatus: fighter.healthStatus,
            clearance,
            state: clearanceState(clearance, now),
            issuedByName: clearance ? (doctorNames.get(clearance.doctorId) ?? null) : null,
            openInjuries: injuries
                .filter((injury) => injury.fighterId === fighter.id && injury.status !== "resolved")
                .map(
                    (injury) =>
                        `${injuryTypeName(injury)} — ${BODY_REGION_LABELS[injury.bodyRegion].toLowerCase()} (${INJURY_STATUS_LABELS[injury.status].toLowerCase()})`,
                ),
            examinations: examinations
                .filter((exam) => exam.fighterId === fighter.id)
                .slice(0, EXAMINATION_OPTIONS)
                .map((exam) => ({ id: exam.id, date: exam.date, type: exam.type, outcome: exam.outcome, summary: exam.summary })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const requestedFighter = param(params.fighter);
    const defaultFighterId = requestedFighter && canAccessFighter(user, requestedFighter) ? requestedFighter : "";
    const preselected = fighters.find((fighter) => fighter.id === defaultFighterId);

    return (
        <>
            <PageHeader
                back={
                    preselected
                        ? { href: routes.doctor.fighter(preselected.id), label: preselected.name }
                        : { href: routes.doctor.clearance, label: "Medical Clearance" }
                }
                eyebrow="Medical Clearance"
                title={preselected ? `Update clearance for ${preselected.name}` : "Issue Medical Clearance"}
                description="The new clearance replaces the current one immediately. Coaches plan training against it, and the fighter and their coaches are notified."
            />
            <GrantClearanceForm
                fighters={fighters}
                defaultFighterId={defaultFighterId}
                defaultExaminationId={param(params.exam) ?? ""}
                today={dayKey(now)}
                now={now}
                doctorName={user.name}
                warningDays={settings.clearanceExpiryWarningDays}
            />
        </>
    );
}

/** API mode: a clearance is issued from the chosen fighter's current positive examination. */
async function IssueClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance/new">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const { fighters, fighter, dossier } = await loadFormFighter(user, param(params.fighter));
    const positive = dossier
        ? Object.values(dossier.currentExaminations).filter((exam): exam is CurrentExamination => exam !== null && exam.decision !== "NOT_ELIGIBLE")
        : [];
    const justExamined = param(params.notice) === "examination-recorded";

    return (
        <>
            <PageHeader
                back={fighter ? { href: routes.doctor.fighter(fighter.id), label: fighter.name } : { href: routes.doctor.clearance, label: "Medical Clearance" }}
                eyebrow="Medical Clearance"
                title={fighter ? `Issue clearance for ${fighter.name}` : "Issue Medical Clearance"}
                description="Coaches plan training against the clearance, and the fighter and their coaches are notified."
            />
            <div className="flex flex-col gap-6">
                {fighter && justExamined && (
                    <Callout tone="success" icon={CircleCheck} role="status" title="Examination recorded">
                        Issue the clearance now so {fighter.name} can train within your decision.
                    </Callout>
                )}
                {!fighter || !dossier ? (
                    <FighterChooser
                        fighters={fighters}
                        hrefFor={(fighterId) => hrefWith(routes.doctor.grantClearance, {}, { fighter: fighterId })}
                        title="Who is the clearance for?"
                        unreadable={fighter}
                    />
                ) : positive.length === 0 ? (
                    <EmptyState
                        icon={<ShieldQuestion />}
                        title="No examination to issue it from"
                        description={`A clearance comes from ${fighter.name}'s current eligible examination. Record one first.`}
                        action={
                            <ButtonLink href={hrefWith(routes.doctor.newExamination, {}, { fighter: fighter.id })}>
                                <ClipboardPlus aria-hidden />
                                New examination
                            </ButtonLink>
                        }
                    />
                ) : (
                    <IssueClearanceForm
                        fighter={{ id: fighter.id, name: fighter.name }}
                        examinations={positive}
                        activeClearances={dossier.activeClearances}
                        defaultExaminationId={param(params.exam) ?? ""}
                        today={dayKey(now)}
                        cancelHref={routes.doctor.fighter(fighter.id)}
                    />
                )}
            </div>
        </>
    );
}
