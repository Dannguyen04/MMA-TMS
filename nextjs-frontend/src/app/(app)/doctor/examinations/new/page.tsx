import type { Metadata } from "next";

import { ExaminationForm, type ExamFighterOption } from "@/components/medical/examination-form";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { clearanceState, currentClearance } from "@/lib/domain/rules";
import type { ExaminationType, MedicalExamination } from "@/lib/domain/types";
import { toDateTimeInputValue } from "@/lib/format";
import { parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listClearances, listExaminations } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "New examination" };

const TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];

export default async function NewExaminationPage({ searchParams }: PageProps<"/doctor/examinations/new">) {
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
