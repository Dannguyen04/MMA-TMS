import { CircleCheck, ClipboardPlus, ShieldQuestion } from "lucide-react";
import { notFound } from "next/navigation";

import { ExamClearanceSteps } from "@/components/medical/exam-clearance-steps";
import { FighterChooser } from "@/components/medical/fighter-chooser";
import { loadFormFighter } from "@/components/medical/form-fighter";
import { GrantClearanceForm, type ClearanceFighterContext } from "@/components/medical/grant-clearance-form";
import { IssueClearanceForm } from "@/components/medical/issue-clearance-form";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
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

import { FormSection } from "./form-section";

/** Recent examinations offered as evidence for the decision. */
const EXAMINATION_OPTIONS = 8;

type Query = Record<string, string | string[] | undefined>;

export interface NewClearanceViewProps {
    query: Query;
    /** Set inside a fighter's profile: the fighter is fixed and the profile header is already on the page. */
    fighterId?: string;
}

/** The clearance form, shared by the standalone page and the section inside a fighter's profile. */
export async function NewClearanceView(props: NewClearanceViewProps) {
    if (usesMedicalServiceForms()) return <IssueClearance {...props} />;
    const { query, fighterId: scopedId } = props;
    const user = await requireRole("doctor");
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

    const requestedFighter = scopedId ?? param(query.fighter);
    const defaultFighterId = requestedFighter && canAccessFighter(user, requestedFighter) ? requestedFighter : "";
    const preselected = fighters.find((fighter) => fighter.id === defaultFighterId);
    if (scopedId && !preselected) notFound();

    const description = "Giấy phép mới thay thế giấy phép hiện tại ngay lập tức. Võ sĩ và huấn luyện viên sẽ được thông báo.";
    const form = (
        <GrantClearanceForm
            fighters={scopedId ? fighters.filter((fighter) => fighter.id === scopedId) : fighters}
            defaultFighterId={defaultFighterId}
            defaultExaminationId={param(query.exam) ?? ""}
            today={dayKey(now)}
            now={now}
            doctorName={user.name}
            warningDays={settings.clearanceExpiryWarningDays}
            fighterLocked={!!scopedId}
            demoFill={isDemoAuthEnabled()}
        />
    );

    if (scopedId) {
        return (
            <FormSection title="Cấp giấy phép" description={description}>
                {form}
            </FormSection>
        );
    }
    return (
        <>
            <PageHeader
                back={preselected ? { href: routes.doctor.fighter(preselected.id), label: preselected.name } : { href: routes.doctor.clearance, label: "Giấy phép" }}
                eyebrow="Giấy phép"
                title={preselected ? `Cập nhật giấy phép cho ${preselected.name}` : "Cấp giấy phép"}
                description={description}
            />
            {form}
        </>
    );
}

/** API mode: a clearance is issued from the chosen fighter's current positive examination. */
async function IssueClearance({ query, fighterId: scopedId }: NewClearanceViewProps) {
    const user = await requireRole("doctor");
    const now = new Date().toISOString();
    const { fighters, fighter, dossier } = await loadFormFighter(user, scopedId ?? param(query.fighter));
    if (scopedId && !fighter) notFound();
    const positive = dossier
        ? Object.values(dossier.currentExaminations).filter((exam): exam is CurrentExamination => exam !== null && exam.decision !== "NOT_ELIGIBLE")
        : [];
    const justExamined = param(query.notice) === "examination-recorded";
    const fromExamination = Boolean(param(query.exam)) && positive.some((exam) => exam.id === param(query.exam));
    const description =
        "Kiểm tra phiếu khám rồi cấp giấy phép từ phiếu đó. Huấn luyện viên lên lịch tập theo giấy phép; võ sĩ và huấn luyện viên sẽ được thông báo.";
    const steps = fromExamination ? <ExamClearanceSteps current={2} /> : undefined;
    const newExamHref = (fighterId: string) => (scopedId ? routes.doctor.fighterNewExamination(fighterId) : hrefWith(routes.doctor.newExamination, {}, { fighter: fighterId }));

    const body = (
        <div className="flex flex-col gap-6">
            {fighter && justExamined && (
                <Callout tone="success" icon={CircleCheck} role="status" title="Đã ghi phiếu khám">
                    Đã lưu. Hãy kiểm tra bên dưới rồi cấp giấy phép để {fighter.name} có thể tập theo quyết định của bạn.
                </Callout>
            )}
            {!fighter || !dossier ? (
                <FighterChooser
                    fighters={fighters}
                    hrefFor={(fighterId) => hrefWith(routes.doctor.grantClearance, {}, { fighter: fighterId })}
                    title="Cấp giấy phép cho võ sĩ nào?"
                    unreadable={fighter}
                />
            ) : positive.length === 0 ? (
                <EmptyState
                    icon={<ShieldQuestion />}
                    title="Chưa có phiếu khám để cấp"
                    description={`Giấy phép được cấp từ phiếu khám hợp lệ của ${fighter.name}. Hãy ghi phiếu khám trước.`}
                    action={
                        <ButtonLink href={newExamHref(fighter.id)}>
                            <ClipboardPlus aria-hidden />
                            Phiếu khám mới
                        </ButtonLink>
                    }
                />
            ) : (
                <IssueClearanceForm
                    fighter={{ id: fighter.id, name: fighter.name }}
                    examinations={positive}
                    activeClearances={dossier.activeClearances}
                    activeInjuries={dossier.activeInjuries.length}
                    defaultExaminationId={param(query.exam) ?? ""}
                    weightLimitKg={fighter.targetWeightKg}
                    today={dayKey(now)}
                    cancelHref={routes.doctor.fighter(fighter.id)}
                    clearancesHref={hrefWith(routes.doctor.fighter(fighter.id), {}, { tab: "clearance" })}
                    demoFill={process.env.NODE_ENV !== "production"}
                />
            )}
        </div>
    );

    if (scopedId) {
        return (
            <FormSection title="Cấp giấy phép" description={description} meta={steps}>
                {body}
            </FormSection>
        );
    }
    return (
        <>
            <PageHeader
                back={fighter ? { href: routes.doctor.fighter(fighter.id), label: fighter.name } : { href: routes.doctor.clearance, label: "Giấy phép" }}
                eyebrow="Giấy phép"
                title={fighter ? `Cấp giấy phép cho ${fighter.name}` : "Cấp giấy phép"}
                description={description}
                meta={steps}
            />
            {body}
        </>
    );
}
