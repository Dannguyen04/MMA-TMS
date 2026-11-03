"use client";

import { ArrowDown, ArrowUp, Info, ListPlus, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FormFooter, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createMilestonePlanAction } from "@/lib/actions/medical-contract";
import { MEDICAL_TEXT_LIMITS, RECOVERY_MILESTONES_MAX } from "@/lib/domain/medical-contract";
import { injuryTypeName } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";

export interface MilestonePlanFormProps {
    fighter: { id: string; name: string };
    /** The fighter's open injuries without a recovery plan in progress. */
    injuries: Injury[];
    defaultInjuryId: string;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    cancelHref: string;
}

interface MilestoneRow {
    key: string;
    title: string;
    criteria: string;
    targetDate: string;
    notes: string;
}

/** A common return-to-training ladder the doctor can start from and edit. */
const STANDARD_STEPS: Pick<MilestoneRow, "title" | "criteria">[] = [
    { title: "Sinh hoạt hằng ngày không đau", criteria: "Không đau khi đi bộ, leo cầu thang hoặc nằm nghiêng bên bị thương." },
    { title: "Biên độ vận động đầy đủ", criteria: "Biên độ vận động bằng bên lành, không đau." },
    { title: "Bài tập chuyên môn", criteria: "Đánh gió và đánh đích tốc độ tối đa, không có triệu chứng vào ngày hôm sau." },
    { title: "Trở lại đấu tập", criteria: "Hai buổi đấu tập nhẹ không triệu chứng, được bác sĩ thể thao xác nhận." },
];

let rowCounter = 0;
const newRow = (values: Partial<MilestoneRow> = {}): MilestoneRow => ({ key: `m${(rowCounter += 1)}`, title: "", criteria: "", targetDate: "", notes: "", ...values });

/**
 * Creates a recovery plan as the medical service keeps it: one injury, dates and an ordered list of milestones,
 * each with how the doctor will know it's reached. Completing milestones never clears the fighter by itself.
 */
export function MilestonePlanForm({ fighter, injuries, defaultInjuryId, today, cancelHref }: MilestonePlanFormProps) {
    const form = useActionForm(createMilestonePlanAction, { id: "milestone-plan", hiddenFields: ["milestones"] });
    const { control, error } = form;
    const baseId = useId();
    const [injuryId, setInjuryId] = useState(injuries.some((injury) => injury.id === defaultInjuryId) ? defaultInjuryId : injuries.length === 1 ? injuries[0].id : "");
    const [startDate, setStartDate] = useState(today);
    const [rows, setRows] = useState<MilestoneRow[]>([]);
    const injury = injuries.find((candidate) => candidate.id === injuryId);

    const update = (key: string, patch: Partial<MilestoneRow>, field: string) => {
        setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
        form.markEdited(field);
    };
    const move = (index: number, by: number) => {
        setRows((current) => {
            const next = [...current];
            const [row] = next.splice(index, 1);
            next.splice(index + by, 0, row);
            return next;
        });
        form.markEdited("milestones");
    };
    const serialized = JSON.stringify(rows.map(({ title, criteria, targetDate, notes }) => ({ title, criteria, targetDate, notes })));

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <input type="hidden" name="fighterId" value={fighter.id} />
                <input type="hidden" name="milestones" value={serialized} />

                <FormSection title="Kế hoạch" info={<TermHint term="recoveryPlan" />} description={`${fighter.name} đang phục hồi sau chấn thương gì và dự kiến khi nào trở lại.`}>
                    <Field label="Chấn thương" htmlFor={control("injuryId").id} error={error("injuryId")} required>
                        <Select
                            {...control("injuryId", { required: true })}
                            value={injuryId}
                            onChange={(event) => setInjuryId(event.target.value)}
                        >
                            <option value="">Chọn chấn thương…</option>
                            {injuries.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {injuryTypeName(option)} · {formatShortDate(option.occurredAt)}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Tiêu đề" htmlFor={control("title").id} error={error("title")} required>
                        {/* Suggested from the injury; choosing another injury suggests again. */}
                        <Input
                            {...control("title", { required: true })}
                            key={injury?.id ?? "none"}
                            defaultValue={injury ? `${injuryTypeName(injury)} — trở lại tập luyện` : ""}
                            maxLength={MEDICAL_TEXT_LIMITS.planTitle}
                        />
                    </Field>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Bắt đầu" htmlFor={control("startDate").id} error={error("startDate")} required>
                            <Input {...control("startDate", { required: true })} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                        </Field>
                        <Field label="Dự kiến kết thúc" htmlFor={control("estimatedEndDate").id} error={error("estimatedEndDate")} optional hint="Để trống nếu chưa ước tính được.">
                            <Input {...control("estimatedEndDate", { hint: true })} type="date" min={startDate || undefined} />
                        </Field>
                    </div>
                    <Field label="Mô tả" htmlFor={control("description").id} error={error("description")} optional hint="Phương pháp, lưu ý và điều võ sĩ cần biết.">
                        <Textarea {...control("description", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
                    </Field>
                </FormSection>

                <FormSection title="Các mốc" info={<TermHint term="milestone" />} description="Theo thứ tự. Mỗi mốc ghi tiêu chí đạt. Có thể thêm sau.">
                    {rows.length === 0 ? (
                        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">Chưa có mốc. Tự thêm hoặc bắt đầu từ các bước chuẩn.</p>
                    ) : (
                        <ol className="flex flex-col gap-3">
                            {rows.map((row, index) => (
                                <li key={row.key} className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-display text-sm font-bold text-fg">Mốc {index + 1}</p>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon-sm" aria-label={`Đưa mốc ${index + 1} lên`} disabled={index === 0} onClick={() => move(index, -1)}>
                                                <ArrowUp aria-hidden />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Đưa mốc ${index + 1} xuống`}
                                                disabled={index === rows.length - 1}
                                                onClick={() => move(index, 1)}
                                            >
                                                <ArrowDown aria-hidden />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Xóa mốc ${index + 1}`}
                                                onClick={() => {
                                                    setRows((current) => current.filter((candidate) => candidate.key !== row.key));
                                                    form.markEdited("milestones");
                                                }}
                                            >
                                                <Trash2 aria-hidden />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                                        <Field label="Mốc" htmlFor={`${baseId}-${row.key}-title`} error={error(`milestones.${index}.title`)} required>
                                            <Input
                                                id={`${baseId}-${row.key}-title`}
                                                value={row.title}
                                                maxLength={MEDICAL_TEXT_LIMITS.planTitle}
                                                onChange={(event) => update(row.key, { title: event.target.value }, `milestones.${index}.title`)}
                                            />
                                        </Field>
                                        <Field label="Ngày mục tiêu" htmlFor={`${baseId}-${row.key}-date`} error={error(`milestones.${index}.targetDate`)} optional>
                                            <Input
                                                id={`${baseId}-${row.key}-date`}
                                                type="date"
                                                min={startDate || undefined}
                                                value={row.targetDate}
                                                onChange={(event) => update(row.key, { targetDate: event.target.value }, `milestones.${index}.targetDate`)}
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Tiêu chí đạt" htmlFor={`${baseId}-${row.key}-criteria`} error={error(`milestones.${index}.criteria`)} required>
                                        <Textarea
                                            id={`${baseId}-${row.key}-criteria`}
                                            rows={2}
                                            value={row.criteria}
                                            maxLength={MEDICAL_TEXT_LIMITS.clinicalText}
                                            onChange={(event) => update(row.key, { criteria: event.target.value }, `milestones.${index}.criteria`)}
                                        />
                                    </Field>
                                </li>
                            ))}
                        </ol>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={rows.length >= RECOVERY_MILESTONES_MAX}
                            onClick={() => {
                                setRows((current) => [...current, newRow()]);
                                form.markEdited("milestones");
                            }}
                        >
                            <Plus aria-hidden />
                            Thêm mốc
                        </Button>
                        {rows.length === 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setRows(STANDARD_STEPS.map((step) => newRow(step)))}>
                                <ListPlus aria-hidden />
                                Bắt đầu từ các bước chuẩn
                            </Button>
                        )}
                    </div>
                    {error("milestones") && <p className="text-[13px] font-medium text-danger-fg">{error("milestones")}</p>}
                </FormSection>

                <FormFooter message={form.message} cancelHref={cancelHref} pending={form.pending} submitLabel="Tạo kế hoạch phục hồi" pendingLabel="Đang tạo kế hoạch…" />
            </Card>

            <aside aria-label="Kế hoạch phục hồi hoạt động thế nào" className="min-w-0">
                <Card>
                    <CardHeader title="Cách hoạt động" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li>{fighter.name} xem kế hoạch và từng mốc trên trang Sức khỏe.</li>
                            <li>Đánh dấu mốc trên trang kế hoạch khi đạt.</li>
                            <li className="font-medium text-fg">Hoàn tất kế hoạch không có nghĩa võ sĩ được tập: hãy khám và cấp giấy phép.</li>
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
