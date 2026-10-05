import type { Metadata } from "next";

import { ExaminationDecisionForm } from "@/components/medical/examination-decision-form";
import { ExaminationForm, type ExamFighterOption } from "@/components/medical/examination-form";
import { FighterChooser } from "@/components/medical/fighter-chooser";
import { loadFormFighter } from "@/components/medical/form-fighter";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { EXAMINATION_SCOPES } from "@/lib/domain/medical-contract";
import { clearanceState, currentClearance } from "@/lib/domain/rules";
import type { ExaminationType, MedicalExamination } from "@/lib/domain/types";
import { toDateTimeInputValue } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listClearances, listExaminations } from "@/lib/services/medical";
import { usesMedicalServiceForms } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "New examination" };

const TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];

export default async function NewExaminationPage(props: PageProps<"/doctor/examinations/new">) {
    if (usesMedicalServiceForms()) return <NewExaminationDecisionPage {...props} />;
    const { searchParams } = props;
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const [assigned, examinations, clearances] = await Promise.all([
        listFighters(user),
        listExaminations({ fighterIds: scope }),
        listClearances({ fighterIds: scope }),
    ]);

    const latestByFighter = new Map<string, MedicalExamination>();
    for (const exam of examinations) if (!latestByFighter.has(exam.fighterId)) latestByFighter.set(exam.fighterId, exam);

    const fighters: ExamFighterOption[] = assigned
        .map((fighter) => {
            const last = latestByFighter.get(fighter.id);
            const clearance = currentClearance(clearances, fighter.id);
            return {
                id: fighter.id,
                name: fighter.name,
                nickname: fighter.nickname,
                weightClass: fighter.weightClass,
                stance: fighter.stance,
                level: fighter.level,
                healthStatus: fighter.healthStatus,
                weightLimitKg: fighter.targetWeightKg,
                dateOfBirth: fighter.dateOfBirth,
                clearanceState: clearanceState(clearance, now),
                clearanceValidUntil: clearance?.status === "revoked" ? null : (clearance?.validUntil ?? null),
                lastExamination: last ? { date: last.date, type: last.type, outcome: last.outcome, vitals: last.vitals } : null,
            };
        })
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
                        : { href: routes.doctor.examinations, label: "Examinations" }
                }
                eyebrow="Examination"
                title="New examination"
                description="Record vitals, assessments and your conclusion. Medical Clearance is updated separately — you'll be prompted if the outcome calls for it."
            />
            <ExaminationForm
                fighters={fighters}
                defaultFighterId={defaultFighterId}
                defaultType={parseEnum(param(params.type), TYPES) ?? ""}
                defaultDateTime={toDateTimeInputValue(now)}
            />
        </>
    );
}

/** API mode: pick the fighter first, then record a decision from that one fighter's audited dossier. */
async function NewExaminationDecisionPage({ searchParams }: PageProps<"/doctor/examinations/new">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const defaultScope = parseEnum(param(params.scope), EXAMINATION_SCOPES) ?? "TRAINING";
    const { fighters, fighter, dossier } = await loadFormFighter(user, param(params.fighter));

    return (
        <>
            <PageHeader
                back={fighter ? { href: routes.doctor.fighter(fighter.id), label: fighter.name } : { href: routes.doctor.examinations, label: "Examinations" }}
                eyebrow="Examination"
                title={fighter ? `Examination for ${fighter.name}` : "New examination"}
                description="Record what you found and whether the fighter may train or compete. Clearance is issued next, from this examination."
            />
            {fighter && dossier ? (
                <ExaminationDecisionForm
                    fighter={{ id: fighter.id, name: fighter.name, dateOfBirth: fighter.dateOfBirth }}
                    currentExaminations={dossier.currentExaminations}
                    openReviewRequests={dossier.openReviewRequests}
                    defaultScope={defaultScope}
                    defaultType={parseEnum(param(params.type), TYPES) ?? ""}
                    weightLimitKg={fighter.targetWeightKg}
                    nowInput={toDateTimeInputValue(now)}
                    now={now}
                    cancelHref={routes.doctor.fighter(fighter.id)}
                />
            ) : (
                <FighterChooser
                    fighters={fighters}
                    hrefFor={(fighterId) => hrefWith(routes.doctor.newExamination, {}, { fighter: fighterId, scope: defaultScope, type: param(params.type) })}
                    title="Who did you examine?"
                    unreadable={fighter}
                />
            )}
        </>
    );
}
