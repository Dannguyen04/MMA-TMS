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
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createExaminationAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS, examinationTitle } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { ExaminationOutcome, ExaminationType, Vitals } from "@/lib/domain/types";
import { addDaysToKey, formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME, EXAMINATION_OUTCOME_DESCRIPTIONS, EXAMINATION_OUTCOME_META, ExaminationOutcomeBadge } from "./clinical-badges";
import { AssessmentsField, EMPTY_VITALS, ExaminationTypeField, FollowUpField, useAssessmentRows, useFollowUpDate, VitalsFields } from "./examination-details-fields";
import { examProgress } from "./exam-progress";
import { ExamProgressRail } from "./exam-progress-rail";
import { DemoFillBar, FormPart } from "./form-parts";
import { defaultExaminationType, vitalsDraftFrom } from "./examination-presets";
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
    /** Where "Hủy" goes; the examinations list unless the form was opened from a fighter's profile. */
    cancelHref?: string;
    /** Opened from the fighter's profile: the fighter is fixed and the profile header already introduces them. */
    fighterLocked?: boolean;
    /** Demo mode: offer a one-click fill with plausible sample values, for presenting the flow. */
    demoFill?: boolean;
}

const OUTCOME_OPTIONS: ChoiceOption<ExaminationOutcome>[] = (Object.keys(EXAMINATION_OUTCOME_LABELS) as ExaminationOutcome[]).map((value) => ({
    value,
    label: EXAMINATION_OUTCOME_LABELS[value],
    description: EXAMINATION_OUTCOME_DESCRIPTIONS[value],
    icon: EXAMINATION_OUTCOME_META[value].icon,
    tone: EXAMINATION_OUTCOME_META[value].tone,
}));
/** Records a medical examination: patient and visit, vitals with live reference ranges, assessments and outcome. */
export function ExaminationForm({
    fighters,
    defaultFighterId,
    defaultType,
    defaultDateTime,
    cancelHref = routes.doctor.examinations,
    fighterLocked = false,
    demoFill = false,
}: ExaminationFormProps) {
    const initialFighter = fighters.find((candidate) => candidate.id === defaultFighterId) ?? null;
    // Without a type in the link, a chosen fighter starts on a baseline (never examined) or a routine check.
    const initialType: ExaminationType | "" = defaultType || (initialFighter ? defaultExaminationType(initialFighter.lastExamination !== null) : "");
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

    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [date, setDate] = useState(defaultDateTime);
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const rows = useAssessmentRows(form, initialType);
    const [outcome, setOutcome] = useState<ExaminationOutcome | "">("");
    const [summary, setSummary] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const followUp = useFollowUpDate(initialType, defaultDateTime.slice(0, 10));

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const scat6 = useScat6Draft({ form, nowInput: defaultDateTime, dateOfBirth: fighter?.dateOfBirth ?? null });
    const examDay = date.slice(0, 10);

    const changeType = (next: ExaminationType | "") => {
        setType(next);
        rows.typeChanged(next);
        followUp.typeChanged(next);
    };

    const steps = examProgress({ date, type, vitals, rows: rows.rows, outcome, summary, recommendations });
    const last = fighter?.lastExamination ?? null;

    /** Demo only: fills every part with plausible values the doctor can still edit; "Xóa hết" empties them again. */
    const fillSample = () => {
        const limit = fighter?.weightLimitKg;
        setVitals({
            weightKg: limit ? (limit - 0.4).toFixed(1) : "70.0",
            restingHeartRate: "58",
            bloodPressureSystolic: "118",
            bloodPressureDiastolic: "76",
            temperatureC: "36.6",
            spo2Pct: "98",
            hydration: "good",
        });
        rows.rows.forEach((_, index) => rows.update(index, { result: "normal", note: "" }));
        setOutcome("fit");
        setSummary("Sinh hiệu trong ngưỡng vận động viên. Khám tim mạch, hô hấp và cơ xương khớp không ghi nhận bất thường.");
        setRecommendations("Tiếp tục tập theo giáo án hiện tại. Giữ cân trong giới hạn hạng cân. Tái khám định kỳ sau 4 tuần.");
        followUp.set(addDaysToKey(examDay, 28));
        form.markEdited("summary");
        form.markEdited("recommendations");
        form.markEdited("outcome");
    };
    const clearAll = () => {
        setVitals(EMPTY_VITALS);
        rows.reset(type);
        setOutcome("");
        setSummary("");
        setRecommendations("");
    };

    const currentLevel = fighter && (fighter.clearanceState === "full" || fighter.clearanceState === "restricted" || fighter.clearanceState === "not_cleared") ? fighter.clearanceState : null;
    const outcomeMismatch = fighter && outcome ? currentLevel !== CLEARANCE_LEVEL_FOR_OUTCOME[outcome] : false;

    return (
        <form {...form.formProps} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {fighterLocked && <input type="hidden" name="fighterId" value={fighterId} />}
            {demoFill && (
                <DemoFillBar
                    className="xl:col-span-2"
                    description="Điền sẵn mọi ô bằng dữ liệu mẫu hợp lý: sinh hiệu trong ngưỡng, các vùng bình thường, kết luận đủ điều kiện, tái khám sau 4 tuần. Vẫn sửa được từng ô trước khi lưu."
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="exam-" id="visit" title="Lần khám" description="Khi nào và loại khám gì. Loại khám quyết định danh sách vùng cần đánh giá.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {!fighterLocked && (
                            <Field label="Võ sĩ" htmlFor={id("fighterId")} error={error("fighterId")} required className="sm:col-span-2 sm:max-w-sm">
                                <Select {...form.control("fighterId", { required: true })} value={fighterId} onChange={(event) => setFighterId(event.target.value)}>
                                    <option value="">Chọn võ sĩ…</option>
                                    {fighters.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        )}
                        <Field label="Ngày giờ" htmlFor={id("date")} error={error("date")} required hint="Giờ học viện (TP. Hồ Chí Minh)">
                            <Input
                                {...form.control("date", { hint: true, required: true })}
                                type="datetime-local"
                                value={date}
                                max={defaultDateTime}
                                onChange={(event) => setDate(event.target.value)}
                            />
                        </Field>
                        <ExaminationTypeField form={form} value={type} onChange={changeType} />
                    </div>
                    {!fighterLocked && <PatientContext fighter={fighter} />}
                </FormPart>

                <FormPart
                    prefix="exam-"
                    id="vitals"
                    title="Sinh hiệu"
                    description="Chỉ số ngoài ngưỡng vận động viên được đánh dấu để đo lại, không bị chặn."
                    aside={`${steps[1]!.text} chỉ số`}
                >
                    <VitalsFields
                        form={form}
                        value={vitals}
                        onChange={setVitals}
                        weightLimitKg={fighter?.weightLimitKg ?? null}
                        required
                        previous={vitalsDraftFrom(last?.vitals)}
                        previousLabel={
                            last && (
                                <>
                                    Lần khám trước: <b className="font-semibold text-fg">{examinationTitle(last)}</b> · {formatDate(last.date)}
                                </>
                            )
                        }
                    />
                </FormPart>

                <FormPart
                    prefix="exam-"
                    id="assess"
                    title="Đánh giá"
                    description="Mỗi hàng một vùng khám. Vùng bất thường cần mô tả để lần tái khám có căn cứ."
                    aside={steps[2]!.state === "need" ? undefined : `${steps[2]!.text} vùng`}
                >
                    <AssessmentsField form={form} type={type} rows={rows} />
                </FormPart>

                {type === "baseline" && (
                    <div className="px-5 py-6 sm:px-7">
                        <Scat6RecordInput scat6={scat6} />
                        <Scat6HistoryFields scat6={scat6} />
                        {scat6.draft.status === "ADMINISTERED" && (
                            <>
                                <Scat6MemoryFields scat6={scat6} />
                                <Scat6BalanceFields scat6={scat6} />
                            </>
                        )}
                    </div>
                )}

                <FormPart prefix="exam-" id="decide" title="Kết luận & kế hoạch" description="Kết luận của bạn, việc võ sĩ và ban huấn luyện cần làm tiếp, và khi nào xem lại.">
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
                        <Textarea
                            {...form.control("summary", { hint: true, required: true })}
                            rows={3}
                            placeholder="VD: Sinh hiệu trong ngưỡng. Khám thực thể không ghi nhận bất thường."
                            value={summary}
                            onChange={(event) => setSummary(event.target.value)}
                        />
                    </Field>
                    <Field label="Khuyến nghị" htmlFor={id("recommendations")} error={error("recommendations")} required hint="Hướng dẫn tập luyện, điều trị và bước tiếp theo.">
                        <Textarea
                            {...form.control("recommendations", { hint: true, required: true })}
                            rows={3}
                            placeholder="VD: Tiếp tục tập theo giáo án hiện tại. Tái khám định kỳ sau 4 tuần."
                            value={recommendations}
                            onChange={(event) => setRecommendations(event.target.value)}
                        />
                    </Field>
                    <FollowUpField form={form} examDay={examDay} value={followUp.value} onChange={followUp.set} hint="Mặc định theo loại khám. Hiện trên trang Hôm nay khi gần đến ngày." />
                </FormPart>
            </Card>

            <div className="xl:sticky xl:top-32">
                <ExamProgressRail
                    steps={steps}
                    actions={
                        <>
                            <FormMessage {...form.message} />
                            <Button type="submit" loading={form.pending} className="w-full">
                                {form.pending ? "Đang lưu phiếu khám…" : "Lưu phiếu khám"}
                            </Button>
                            <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                                Hủy
                            </Link>
                        </>
                    }
                    footer={
                        <>
                            <p className="mb-1 font-semibold text-fg-muted">Sau khi lưu</p>
                            Phiếu hiện trong tab Phiếu khám và trên trang Sức khỏe của võ sĩ. Giấy phép không tự đổi; nếu kết luận khác giấy phép hiện tại, hệ thống sẽ đề nghị cập nhật.
                        </>
                    }
                />
            </div>
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
                        Giấy phép {fighter.clearanceState === "expired" ? "expired" : "hiệu lực đến"} {formatDate(fighter.clearanceValidUntil)}
                    </p>
                )}
            </div>
            <div className="min-w-0 text-[13px]">
                {last ? (
                    <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
                            Lần khám gần nhất: <span className="font-medium text-fg">{examinationTitle(last)}</span>
                            <span>{formatDate(last.date)}</span>
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
                                    <dd className="font-medium text-fg">{last.vitals.restingHeartRate} bpm</dd>
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
