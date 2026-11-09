import { notFound } from "next/navigation";

import { ExamClearanceSteps } from "@/components/medical/exam-clearance-steps";
import { ExaminationDecisionForm } from "@/components/medical/examination-decision-form";
import { ExaminationForm, type ExamFighterOption } from "@/components/medical/examination-form";
import { FighterChooser } from "@/components/medical/fighter-chooser";
import { loadFormFighter } from "@/components/medical/form-fighter";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
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

import { FormSection } from "./form-section";

const TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];

type Query = Record<string, string | string[] | undefined>;

export interface NewExaminationViewProps {
    query: Query;
    /** Set inside a fighter's profile: the fighter is fixed and the profile header is already on the page. */
    fighterId?: string;
}

/** The new-examination form, shared by the standalone page and the section inside a fighter's profile. */
export async function NewExaminationView(props: NewExaminationViewProps) {
    if (usesMedicalServiceForms()) return <NewExaminationDecision {...props} />;
    const { query, fighterId: scopedId } = props;
    const user = await requireRole("doctor");
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

    const requestedFighter = scopedId ?? param(query.fighter);
    const defaultFighterId = requestedFighter && canAccessFighter(user, requestedFighter) ? requestedFighter : "";
    const preselected = fighters.find((fighter) => fighter.id === defaultFighterId);
    if (scopedId && !preselected) notFound();

    const description = "Ghi chỉ số sinh tồn, đánh giá và kết luận. Giấy phép được cập nhật riêng — hệ thống sẽ nhắc nếu cần.";
    const form = (
        <ExaminationForm
            // Inside the profile only this fighter is offered, so the choice can't drift to someone else.
            fighters={scopedId ? fighters.filter((fighter) => fighter.id === scopedId) : fighters}
            defaultFighterId={defaultFighterId}
            defaultType={parseEnum(param(query.type), TYPES) ?? ""}
            defaultDateTime={toDateTimeInputValue(now)}
            cancelHref={scopedId ? routes.doctor.fighter(scopedId) : routes.doctor.examinations}
            fighterLocked={!!scopedId}
            demoFill={isDemoAuthEnabled()}
        />
    );

    if (scopedId) {
        return (
            <FormSection title="Tạo phiếu khám" description={description}>
                {form}
            </FormSection>
        );
    }
    return (
        <>
            <PageHeader
                back={preselected ? { href: routes.doctor.fighter(preselected.id), label: preselected.name } : { href: routes.doctor.examinations, label: "Phiếu khám" }}
                eyebrow="Phiếu khám"
                title="Phiếu khám mới"
                description={description}
            />
            {form}
        </>
    );
}

/** API mode: pick the fighter first, then record a decision from that one fighter's audited dossier. */
async function NewExaminationDecision({ query, fighterId: scopedId }: NewExaminationViewProps) {
    const user = await requireRole("doctor");
    const now = new Date().toISOString();
    const defaultScope = parseEnum(param(query.scope), EXAMINATION_SCOPES) ?? "TRAINING";
    const { fighters, fighter, dossier } = await loadFormFighter(user, scopedId ?? param(query.fighter));
    if (scopedId && !fighter) notFound();
    // The link's type first; otherwise a baseline for a fighter still waiting for one, a pre-fight check for the
    // competition scope, and a routine check for everyone else. The doctor can change it.
    const needsBaseline = dossier?.eligibility.TRAINING.reasons.includes("EXAMINATION_REQUIRED") ?? false;
    const defaultType =
        parseEnum(param(query.type), TYPES) ?? (needsBaseline && defaultScope === "TRAINING" ? "baseline" : defaultScope === "COMPETITION" ? "pre_fight" : fighter ? "routine" : "");
    const description = "Ghi kết quả khám và quyết định võ sĩ có được tập/thi đấu. Giấy phép được cấp ở bước tiếp theo từ phiếu khám này.";
    const steps = fighter && dossier ? <ExamClearanceSteps current={1} /> : undefined;

    const body =
        fighter && dossier ? (
            <ExaminationDecisionForm
                fighter={{ id: fighter.id, name: fighter.name, dateOfBirth: fighter.dateOfBirth }}
                currentExaminations={dossier.currentExaminations}
                openReviewRequests={dossier.openReviewRequests}
                defaultScope={defaultScope}
                defaultType={defaultType}
                weightLimitKg={fighter.targetWeightKg}
                nowInput={toDateTimeInputValue(now)}
                now={now}
                cancelHref={routes.doctor.fighter(fighter.id)}
            />
        ) : (
            <FighterChooser
                fighters={fighters}
                hrefFor={(fighterId) => hrefWith(routes.doctor.newExamination, {}, { fighter: fighterId, scope: defaultScope, type: param(query.type) })}
                title="Bạn đã khám võ sĩ nào?"
                unreadable={fighter}
            />
        );

    if (scopedId) {
        return (
            <FormSection title="Tạo phiếu khám" description={description} meta={steps}>
                {body}
            </FormSection>
        );
    }
    return (
        <>
            <PageHeader
                back={fighter ? { href: routes.doctor.fighter(fighter.id), label: fighter.name } : { href: routes.doctor.examinations, label: "Phiếu khám" }}
                eyebrow="Phiếu khám"
                title={fighter ? `Phiếu khám cho ${fighter.name}` : "Phiếu khám mới"}
                description={description}
                meta={steps}
            />
            {body}
        </>
    );
}
