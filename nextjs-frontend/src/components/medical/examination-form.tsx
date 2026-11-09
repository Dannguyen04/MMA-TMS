"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createExaminationAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS, examinationTitle } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { ExaminationOutcome, ExaminationType, Vitals } from "@/lib/domain/types";
import { formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME, EXAMINATION_OUTCOME_DESCRIPTIONS, EXAMINATION_OUTCOME_META, ExaminationOutcomeBadge } from "./clinical-badges";
import { AssessmentsField, ExaminationTypeField, FollowUpField, useAssessmentRows, VitalsFields, type VitalsDraft } from "./examination-details-fields";
import { Scat6BalanceFields, Scat6HistoryFields, Scat6MemoryFields, Scat6RecordInput, useScat6Draft } from "./scat6-fields";

export interface ExamFighterOption extends FighterIdentityData {
    id: string;
    weightLimitKg: number;
    dateOfBirth: string;
    clearanceState: ClearanceState;
    clearanceValidUntil: string | null;
    lastExamination: { date: string; type: ExaminationType | null; outcome: ExaminationOutcome; vitals: Vitals | null } | null;
}

export interface ExaminationFormProps {
    fighters: ExamFighterOption[];
    defaultFighterId: string;
    defaultType: ExaminationType | "";
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    defaultDateTime: string;
}

const OUTCOME_OPTIONS: ChoiceOption<ExaminationOutcome>[] = (Object.keys(EXAMINATION_OUTCOME_LABELS) as ExaminationOutcome[]).map((value) => ({
    value,
    label: EXAMINATION_OUTCOME_LABELS[value],
    description: EXAMINATION_OUTCOME_DESCRIPTIONS[value],
    icon: EXAMINATION_OUTCOME_META[value].icon,
    tone: EXAMINATION_OUTCOME_META[value].tone,
}));
// This form is only mounted in demo mode. Sample findings are editable.
const DEMO_EXAMINATION_DEFAULTS = {
    type: "routine",
    vitals: {
        weightKg: "68",
        restingHeartRate: "62",
        bloodPressureSystolic: "118",
        bloodPressureDiastolic: "76",
        temperatureC: "36.7",
        spo2Pct: "98",
        hydration: "good",
    },
    assessmentResult: "normal",
    outcome: "fit",
    summary: "Mẫu demo: Sinh hiệu ổn định, chưa ghi nhận bất thường khi khám.",
    recommendations: "Tiếp tục tập theo kế hoạch, duy trì đủ nước và báo bác sĩ nếu có triệu chứng mới.",
    scat6NotAdministeredReason: "Mẫu demo: Chưa thực hiện bài đánh giá SCAT6.",
} as const;

/** Records a medical examination: patient and visit, vitals with live reference ranges, assessments and outcome. */
export function ExaminationForm({ fighters, defaultFighterId, defaultType, defaultDateTime }: ExaminationFormProps) {
    const initialType = defaultType || DEMO_EXAMINATION_DEFAULTS.type;
    const [type, setType] = useState<ExaminationType | "">(initialType);
    const form = useActionForm(createExaminationAction, {
        id: "exam",
        hiddenFields: ["scat6"],
        // A SCAT6 answer left blank (or a tick row nobody marked) is marked in place instead of being sent as "none".
        prepare: () => {
            const problems = type === "baseline" ? scat6.validateAll() : null;
            if (problems) return { status: "error", message: "Một số câu trả lời SCAT6 cần xem lại. Đã đánh dấu bên dưới.", fieldErrors: problems };
        },
    });
    const id = (name: string) => `exam-${name}`;
    const { error } = form;

    const [selectedFighterId, setSelectedFighterId] = useState("");
    const fighterId = defaultFighterId || selectedFighterId;
    const [date, setDate] = useState(defaultDateTime);
    const [vitals, setVitals] = useState<VitalsDraft>(DEMO_EXAMINATION_DEFAULTS.vitals);
    const rows = useAssessmentRows(form, initialType, DEMO_EXAMINATION_DEFAULTS.assessmentResult);
    const [outcome, setOutcome] = useState<ExaminationOutcome | "">(DEMO_EXAMINATION_DEFAULTS.outcome);
    const [summary, setSummary] = useState<string>(DEMO_EXAMINATION_DEFAULTS.summary);
    const [recommendations, setRecommendations] = useState<string>(DEMO_EXAMINATION_DEFAULTS.recommendations);
    const [followUpDate, setFollowUpDate] = useState("");

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const scat6 = useScat6Draft({ form, nowInput: defaultDateTime, dateOfBirth: fighter?.dateOfBirth ?? null, initialNotAdministeredReason: DEMO_EXAMINATION_DEFAULTS.scat6NotAdministeredReason });
    const examDay = date.slice(0, 10);

    const changeType = (next: ExaminationType | "") => {
        setType(next);
        rows.typeChanged(next);
    };

    const currentLevel = fighter && (fighter.clearanceState === "full" || fighter.clearanceState === "restricted" || fighter.clearanceState === "not_cleared") ? fighter.clearanceState : null;
    const outcomeMismatch = fighter && outcome ? currentLevel !== CLEARANCE_LEVEL_FOR_OUTCOME[outcome] : false;

    return (
        <form {...form.formProps}>
            <Card className="px-5 py-6 sm:px-6">
                <FormSection title="Bệnh nhân & lần khám" description="Khám ai, loại khám gì và khi nào.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Võ sĩ" htmlFor={id("fighterId")} error={error("fighterId")} required>
                            <Select
                                {...form.control("fighterId", { required: true })}
                                name={fighterId ? undefined : "fighterId"}
                                value={fighterId}
                                disabled={Boolean(fighterId)}
                                onChange={(event) => setSelectedFighterId(event.target.value)}
                            >
                                <option value="">Chọn võ sĩ…</option>
                                {fighters.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Select>
                            {fighterId && <input type="hidden" name="fighterId" value={fighterId} />}
                        </Field>
                        <Field label="Ngày giờ" htmlFor={id("date")} error={error("date")} required hint="Giờ học viện (TP. Hồ Chí Minh)">
                            <Input
                                {...form.control("date", { hint: true, required: true })}
                                type="datetime-local"
                                value={date}
                                max={defaultDateTime}
                                onChange={(event) => setDate(event.target.value)}
                            />
                        </Field>
                        <ExaminationTypeField form={form} value={type} onChange={changeType} className="sm:col-span-2" />
                    </div>
                    <PatientContext fighter={fighter} />
                </FormSection>

                <FormSection
                    title="Sinh hiệu"
                    description="Ngưỡng tham chiếu cập nhật khi bạn nhập. Chỉ số ngoài ngưỡng được đánh dấu để đo lại, không bị chặn."
                >
                    <VitalsFields form={form} value={vitals} onChange={setVitals} weightLimitKg={fighter?.weightLimitKg ?? null} required />
                </FormSection>

                <FormSection
                    title="Đánh giá"
                    description="Mỗi dòng một vùng khám. Mô tả mọi dấu hiệu bất thường để hồ sơ hữu ích khi tái khám."
                >
                    <AssessmentsField form={form} type={type} rows={rows} />
                </FormSection>

                {type === "baseline" && (
                    <>
                        <Scat6RecordInput scat6={scat6} />
                        <Scat6HistoryFields scat6={scat6} />
                        {scat6.draft.status === "ADMINISTERED" && (
                            <>
                                <Scat6MemoryFields scat6={scat6} />
                                <Scat6BalanceFields scat6={scat6} />
                            </>
                        )}
                    </>
                )}

                <FormSection title="Kết luận & kế hoạch" description="Kết luận của bạn, việc võ sĩ và ban huấn luyện cần làm tiếp và khi nào xem lại.">
                    <div>
                        <ChoiceGroup
                            id={id("outcome")}
                            name="outcome"
                            legend="Kết luận"
                            required
                            columns={3}
                            options={OUTCOME_OPTIONS}
                            value={outcome}
                            onChange={setOutcome}
                            error={error("outcome")}
                        />
                        <div aria-live="polite">
                            {fighter && outcome && (
                                <InlineNote icon={Info} tone={outcomeMismatch ? "info" : "neutral"} className="mt-2">
                                    {outcomeMismatch
                                        ? `Kết luận này tương ứng “${CLEARANCE_LEVEL_LABELS[CLEARANCE_LEVEL_FOR_OUTCOME[outcome]]}”, nhưng giấy phép hiện tại của ${fighter.name} là ${currentLevel ? `“${CLEARANCE_LEVEL_LABELS[currentLevel]}”` : fighter.clearanceState === "expired" ? "đã hết hạn" : "chưa có"}. Lưu phiếu không đổi giấy phép — hệ thống sẽ đề nghị cập nhật ở bước sau.`
                                        : "Khớp với giấy phép hiện tại."}
                                </InlineNote>
                            )}
                        </div>
                    </div>

                    <Field label="Tóm tắt kết quả khám" htmlFor={id("summary")} error={error("summary")} required hint="Võ sĩ xem được trên trang Sức khỏe.">
                        <Textarea {...form.control("summary", { hint: true, required: true })} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
                    </Field>
                    <Field label="Khuyến nghị" htmlFor={id("recommendations")} error={error("recommendations")} required hint="Hướng dẫn tập luyện, điều trị và bước tiếp theo.">
                        <Textarea
                            {...form.control("recommendations", { hint: true, required: true })}
                            rows={3}
                            value={recommendations}
                            onChange={(event) => setRecommendations(event.target.value)}
                        />
                    </Field>
                    <FollowUpField form={form} examDay={examDay} value={followUpDate} onChange={setFollowUpDate} hint="Hiện trên trang Hôm nay khi gần đến ngày." />
                </FormSection>

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <FormMessage {...form.message} />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link href={routes.doctor.examinations} className={buttonClasses({ variant: "secondary" })}>
                            Hủy
                        </Link>
                        <Button type="submit" loading={form.pending}>
                            {form.pending ? "Đang lưu phiếu khám…" : "Lưu phiếu khám"}
                        </Button>
                    </div>
                </div>
            </Card>
        </form>
    );
}

function PatientContext({ fighter }: { fighter: ExamFighterOption | null }) {
    if (!fighter) {
        return <p className="rounded-lg bg-surface-muted px-4 py-3 text-[13px] text-fg-muted">Chọn võ sĩ để xem giấy phép hiện tại và lần khám gần nhất.</p>;
    }
    const last = fighter.lastExamination;
    return (
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-muted px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="flex min-w-0 flex-col gap-2">
                <FighterIdentity fighter={fighter} size="sm" />
                <div className="flex flex-wrap gap-1.5">
                    <HealthStatusBadge status={fighter.healthStatus} size="sm" />
                    <ClearanceBadge state={fighter.clearanceState} size="sm" />
                </div>
                {fighter.clearanceValidUntil && fighter.clearanceState !== "none" && (
                    <p className="text-xs text-fg-muted">
                        Giấy phép {fighter.clearanceState === "expired" ? "hết hạn ngày" : "hiệu lực đến"} {formatDate(fighter.clearanceValidUntil, "vi")}
                    </p>
                )}
            </div>
            <div className="min-w-0 text-[13px]">
                {last ? (
                    <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
                            Lần khám gần nhất: <span className="font-medium text-fg">{examinationTitle(last)}</span>
                            <span>{formatDate(last.date, "vi")}</span>
                            <ExaminationOutcomeBadge outcome={last.outcome} size="sm" />
                        </p>
                        {last.vitals && (
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
                                <div className="flex gap-1">
                                    <dt>Cân nặng</dt>
                                    <dd className="font-medium text-fg">{formatNumber(last.vitals.weightKg, 1)} kg</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>Mạch nghỉ</dt>
                                    <dd className="font-medium text-fg">{last.vitals.restingHeartRate} nhịp/phút</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>Huyết áp</dt>
                                    <dd className="font-medium text-fg">
                                        {last.vitals.bloodPressureSystolic}/{last.vitals.bloodPressureDiastolic}
                                    </dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>Giới hạn hạng cân</dt>
                                    <dd className="font-medium text-fg">{formatNumber(fighter.weightLimitKg, 1)} kg</dd>
                                </div>
                            </dl>
                        )}
                    </>
                ) : (
                    <p className="text-fg-muted">Chưa có phiếu khám nào — đây sẽ là lần đầu. Nên khám nền.</p>
                )}
            </div>
        </div>
    );
}
