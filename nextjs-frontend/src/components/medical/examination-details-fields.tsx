"use client";

import { CheckCheck, CircleCheck, ListRestart, Plus, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { TONE_SOFT, TONE_TEXT } from "@/components/ui/tone";
import type { ActionForm } from "@/components/ui/use-action-form";
import { ASSESSMENT_RESULT_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { AssessmentResult, ExaminationType } from "@/lib/domain/types";
import { addDaysToKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ASSESSMENT_RESULT_META } from "./clinical-badges";
import { ASSESSMENT_PRESETS, checkVitals, EXAMINATION_TYPE_HINTS, markUnmarkedNormal, unmarkedAreas, type VitalCheck } from "./examination-presets";
import { QuickFill } from "./quick-fill";

/**
 * What a doctor records at the visit, shared by the demo examination form and the medical service's examination form:
 * vitals with live athlete reference ranges, one row per area assessed, and a follow-up date.
 */

type FormControls = Pick<ActionForm<unknown>, "error" | "control" | "markEdited">;

type VitalField = "weightKg" | "restingHeartRate" | "bloodPressureSystolic" | "bloodPressureDiastolic" | "temperatureC" | "spo2Pct";

export type VitalsDraft = Record<VitalField | "hydration", string>;

const EXAMINATION_TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];

/** The kind of visit, which also sets the starting assessments. */
export function ExaminationTypeField({
    form,
    value,
    onChange,
    className,
}: {
    form: FormControls;
    value: ExaminationType | "";
    onChange: (type: ExaminationType | "") => void;
    className?: string;
}) {
    return (
        <Field
            label="Loại phiếu khám"
            htmlFor={form.control("type").id}
            error={form.error("type")}
            required
            hint={value ? EXAMINATION_TYPE_HINTS[value] : "Loại khám quyết định danh sách đánh giá ban đầu."}
            info={<TermHint term="baselineExam" />}
            className={className}
        >
            <Select {...form.control("type", { hint: true, required: true })} value={value} onChange={(event) => onChange(event.target.value as ExaminationType | "")} className="sm:max-w-sm">
                <option value="">Chọn loại…</option>
                {EXAMINATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                        {EXAMINATION_TYPE_LABELS[type]}
                    </option>
                ))}
            </Select>
        </Field>
    );
}

export const EMPTY_VITALS: VitalsDraft = { weightKg: "", restingHeartRate: "", bloodPressureSystolic: "", bloodPressureDiastolic: "", temperatureC: "", spo2Pct: "", hydration: "" };

export interface VitalsFieldsProps {
    form: FormControls;
    value: VitalsDraft;
    onChange: (next: VitalsDraft) => void;
    /** The fighter's class limit, for the weight check. */
    weightLimitKg: number | null;
    /** Vitals go together: when optional, filling any reading makes the rest required. */
    required: boolean;
}

/** The seven readings, each checked against athlete reference ranges as it's typed. Out-of-range readings are flagged, never blocked. */
export function VitalsFields({ form, value, onChange, weightLimitKg, required }: VitalsFieldsProps) {
    const { error } = form;
    const checks = checkVitals(value, weightLimitKg);
    const outOfRange = Object.values(checks).filter((check) => check?.status === "check").length;
    const set = (name: keyof VitalsDraft, next: string) => onChange({ ...value, [name]: next });
    const id = (name: string) => form.control(name).id;
    const bpRangeId = `${id("bp")}-range`;

    const vitalInput = (name: VitalField, label: string, unit: string, props: { step?: string; min?: number; max?: number }, check: VitalCheck | undefined, info?: ReactNode) => {
        const message = error(name);
        const hintId = `${id(name)}-range`;
        return (
            <Field label={`${label} (${unit})`} htmlFor={id(name)} error={message} required={required} info={info}>
                <Input
                    {...form.control(name, { required })}
                    type="number"
                    inputMode="decimal"
                    value={value[name]}
                    onChange={(event) => set(name, event.target.value)}
                    step={props.step ?? "1"}
                    min={props.min}
                    max={props.max}
                    aria-describedby={message ? `${id(name)}-error` : check ? hintId : undefined}
                />
                {!message && <RangeHint id={hintId} check={check ?? null} />}
            </Field>
        );
    };

    return (
        <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {vitalInput("weightKg", "Cân nặng", "kg", { step: "0.1", min: 35, max: 180 }, checks.weightKg)}
                {vitalInput("restingHeartRate", "Mạch nghỉ", "bpm", { min: 25, max: 150 }, checks.restingHeartRate, <TermHint term="restingHeartRate" />)}
                {vitalInput("temperatureC", "Nhiệt độ", "°C", { step: "0.1", min: 33, max: 42 }, checks.temperatureC, <TermHint term="bodyTemperature" />)}
                <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 xl:col-span-2">
                    <legend className="mb-1.5 text-sm font-medium text-fg">
                        Huyết áp (mmHg)
                        {required && (
                            <span className="ml-0.5 text-danger-fg" aria-hidden>
                                *
                            </span>
                        )}
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                        <BpInput
                            id={id("bloodPressureSystolic")}
                            name="bloodPressureSystolic"
                            label="Tâm thu"
                            info={<TermHint term="systolicPressure" />}
                            value={value.bloodPressureSystolic}
                            required={required}
                            error={error("bloodPressureSystolic")}
                            rangeId={bpRangeId}
                            onChange={(next) => set("bloodPressureSystolic", next)}
                        />
                        <BpInput
                            id={id("bloodPressureDiastolic")}
                            name="bloodPressureDiastolic"
                            label="Tâm trương"
                            info={<TermHint term="diastolicPressure" />}
                            value={value.bloodPressureDiastolic}
                            required={required}
                            error={error("bloodPressureDiastolic")}
                            rangeId={bpRangeId}
                            onChange={(next) => set("bloodPressureDiastolic", next)}
                        />
                    </div>
                    <RangeHint id={bpRangeId} check={checks.bloodPressure} />
                </fieldset>
                {vitalInput("spo2Pct", "SpO2", "%", { min: 70, max: 100 }, checks.spo2Pct, <TermHint term="spo2" />)}
                <Field label="Mức nước" htmlFor={id("hydration")} error={error("hydration")} required={required} info={<TermHint term="hydration" />}>
                    <Select
                        {...form.control("hydration", { required })}
                        value={value.hydration}
                        onChange={(event) => set("hydration", event.target.value)}
                        aria-describedby={error("hydration") ? `${id("hydration")}-error` : checks.hydration ? `${id("hydration")}-range` : undefined}
                    >
                        <option value="">Chọn…</option>
                        <option value="good">Tốt</option>
                        <option value="fair">Trung bình</option>
                        <option value="poor">Kém</option>
                    </Select>
                    {!error("hydration") && <RangeHint id={`${id("hydration")}-range`} check={checks.hydration} />}
                </Field>
            </div>
            <p aria-live="polite" className={cn("text-[13px]", outOfRange > 0 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                {outOfRange > 0
                    ? `${outOfRange} chỉ số nằm ngoài ngưỡng tham chiếu vận động viên — nên đo lại.`
                    : "Mọi chỉ số đã nhập đều trong ngưỡng tham chiếu."}
            </p>
        </>
    );
}

function RangeHint({ id, check }: { id: string; check: VitalCheck }) {
    if (!check) return null;
    const normal = check.status === "normal";
    return (
        <p id={id} className={cn("flex items-start gap-1 text-[13px]", normal ? "text-fg-subtle" : "font-medium text-warning-fg")}>
            {normal ? <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
            <span>
                <span className="sr-only">{normal ? "Trong ngưỡng:" : "Cần kiểm tra:"}</span>
                {check.text}
            </span>
        </p>
    );
}

function BpInput({
    id,
    name,
    label,
    info,
    value,
    required,
    error,
    rangeId,
    onChange,
}: {
    id: string;
    name: string;
    label: string;
    info?: ReactNode;
    value: string;
    required: boolean;
    error?: string;
    rangeId: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1">
                <label htmlFor={id} className="text-xs text-fg-muted">
                    {label}
                </label>
                {info}
            </div>
            <Input
                id={id}
                name={name}
                type="number"
                inputMode="numeric"
                min={40}
                max={220}
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : rangeId}
            />
            {error && (
                <p id={`${id}-error`} className="text-[13px] font-medium text-danger-fg">
                    {error}
                </p>
            )}
        </div>
    );
}

/* ─── Assessments ─────────────────────────────────────────────────────────── */

export interface AssessmentRow {
    key: number;
    area: string;
    result: AssessmentResult | "";
    note: string;
}

const RESULTS = Object.keys(ASSESSMENT_RESULT_LABELS) as AssessmentResult[];

const presetRows = (type: ExaminationType | "", startKey: number): AssessmentRow[] =>
    (type ? ASSESSMENT_PRESETS[type] : []).map((area, index) => ({ key: startKey + index, area, result: "", note: "" }));

/**
 * Assessment rows that start from the examination type's list. Until the doctor edits a row, changing the type swaps
 * the list; afterwards their rows stay and "Reset" brings the list back.
 */
export function useAssessmentRows(form: FormControls, initialType: ExaminationType | "") {
    const [rows, setRows] = useState<AssessmentRow[]>(() => presetRows(initialType, 0));
    const [edited, setEdited] = useState(false);
    const [nextKey, setNextKey] = useState(100);

    /** Adding, removing or reloading rows shifts their indexes, so every row error is stale. */
    const replace = (next: AssessmentRow[]) => {
        setRows(next);
        form.markEdited("assessments");
    };
    const loadPreset = (type: ExaminationType | "") => {
        replace(presetRows(type, nextKey));
        setNextKey((key) => key + 10);
    };

    return {
        rows,
        edited,
        typeChanged: (type: ExaminationType | "") => {
            if (!edited) loadPreset(type);
        },
        reset: (type: ExaminationType | "") => {
            loadPreset(type);
            setEdited(false);
        },
        update: (index: number, patch: Partial<AssessmentRow>) => {
            setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
            Object.keys(patch).forEach((field) => form.markEdited(`assessments.${index}.${field}`));
            setEdited(true);
        },
        remove: (key: number) => {
            replace(rows.filter((row) => row.key !== key));
            setEdited(true);
        },
        add: () => {
            replace([...rows, { key: nextKey, area: "", result: "", note: "" }]);
            setNextKey((key) => key + 1);
            setEdited(true);
        },
        /** The doctor's "mark the unmarked areas Normal": named rows without a result only. Returns the areas it marked. */
        markUnmarkedNormal: (): string[] => {
            const { rows: next, filled } = markUnmarkedNormal(rows);
            if (filled.length === 0) return filled;
            setRows(next);
            next.forEach((row, index) => {
                if (row !== rows[index]) form.markEdited(`assessments.${index}.result`);
            });
            setEdited(true);
            return filled;
        },
    };
}

export type AssessmentRows = ReturnType<typeof useAssessmentRows>;

/** One row per area examined, sent as a single serialized field. No row starts with a result. */
export function AssessmentsField({
    form,
    type,
    rows,
    checkMissing = false,
}: {
    form: FormControls;
    type: ExaminationType | "";
    rows: AssessmentRows;
    /** After the doctor tried to move on: rows still without a name or result are marked, so none is taken as examined. */
    checkMissing?: boolean;
}) {
    const idPrefix = form.control("assessment").id;
    const [note, setNote] = useState<string>();
    const unmarked = unmarkedAreas(rows.rows).length;
    const markNormal = () => {
        const filled = rows.markUnmarkedNormal();
        if (filled.length > 0) setNote(`Đã đánh dấu Bình thường: ${filled.join(", ")}. Hãy sửa mục nào không đúng.`);
    };
    return (
        <>
            <input type="hidden" name="assessments" value={JSON.stringify(rows.rows.map(({ area, result, note }) => ({ area, result, note })))} />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-fg-muted">{type ? `Danh sách ban đầu cho ${EXAMINATION_TYPE_LABELS[type].toLowerCase()}.` : "Chọn loại phiếu khám để tải danh sách ban đầu."}</p>
                {type && rows.edited && (
                    <Button variant="ghost" size="sm" onClick={() => rows.reset(type)}>
                        <ListRestart aria-hidden />
                        Đặt lại theo {EXAMINATION_TYPE_LABELS[type].toLowerCase()} list
                    </Button>
                )}
            </div>
            <QuickFill
                label={`Đánh dấu ${unmarked === 1 ? "vùng chưa ghi" : `${unmarked} vùng chưa ghi`} là Bình thường`}
                icon={CheckCheck}
                available={unmarked > 0}
                note={note}
                onClick={markNormal}
            />
            {form.error("assessments") && <p className="text-[13px] font-medium text-danger-fg">{form.error("assessments")}</p>}
            <ol className="flex flex-col gap-3">
                {rows.rows.map((row, index) => (
                    <AssessmentRowEditor
                        key={row.key}
                        row={row}
                        index={index}
                        idPrefix={`${idPrefix}-${row.key}`}
                        errors={{
                            area: form.error(`assessments.${index}.area`) ?? (checkMissing && !row.area.trim() ? "Ghi tên vùng được đánh giá, hoặc xóa dòng." : undefined),
                            result: form.error(`assessments.${index}.result`) ?? (checkMissing && !row.result ? "Chọn kết quả." : undefined),
                            note: form.error(`assessments.${index}.note`) ?? (checkMissing && row.result === "abnormal" && !row.note.trim() ? "Mô tả dấu hiệu bất thường." : undefined),
                        }}
                        onChange={(patch) => rows.update(index, patch)}
                        onRemove={() => rows.remove(row.key)}
                    />
                ))}
            </ol>
            <Button variant="secondary" size="sm" className="self-start" onClick={rows.add}>
                <Plus aria-hidden />
                Thêm đánh giá
            </Button>
        </>
    );
}

function AssessmentRowEditor({
    row,
    index,
    idPrefix,
    errors,
    onChange,
    onRemove,
}: {
    row: AssessmentRow;
    index: number;
    idPrefix: string;
    errors: { area?: string; result?: string; note?: string };
    onChange: (patch: Partial<AssessmentRow>) => void;
    onRemove: () => void;
}) {
    const name = row.area.trim() || `đánh giá ${index + 1}`;
    const noteRequired = row.result === "abnormal";
    return (
        <li className={cn("rounded-lg border bg-surface-muted/50 p-3", errors.area || errors.result || errors.note ? "border-danger-border" : "border-border")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${idPrefix}-area`} className="sr-only">
                        Vùng được đánh giá, dòng {index + 1}
                    </label>
                    <Input
                        id={`${idPrefix}-area`}
                        value={row.area}
                        onChange={(event) => onChange({ area: event.target.value })}
                        placeholder="Vùng đánh giá, VD Hawkins–Kennedy"
                        aria-invalid={errors.area ? true : undefined}
                        aria-describedby={errors.area ? `${idPrefix}-area-error` : undefined}
                        className="font-medium"
                    />
                    {errors.area && (
                        <p id={`${idPrefix}-area-error`} className="text-[13px] font-medium text-danger-fg">
                            {errors.area}
                        </p>
                    )}
                </div>
                <div className="col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                    <div
                        role="radiogroup"
                        aria-label={`Kết quả cho ${name}`}
                        aria-invalid={errors.result ? true : undefined}
                        aria-describedby={errors.result ? `${idPrefix}-result-error` : undefined}
                        className={cn("grid grid-cols-3 rounded-lg border bg-surface p-0.5 lg:inline-flex", errors.result ? "border-danger-solid" : "border-border")}
                    >
                        {RESULTS.map((result) => {
                            const meta = ASSESSMENT_RESULT_META[result];
                            const Icon = meta.icon;
                            const checked = row.result === result;
                            return (
                                <label
                                    key={result}
                                    className={cn(
                                        "inline-flex h-8 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-[13px] font-medium whitespace-nowrap transition-colors lg:px-2.5",
                                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
                                        checked ? cn(TONE_SOFT[meta.tone], "ring-1 ring-inset") : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                                    )}
                                >
                                    <input type="radio" name={`${idPrefix}-result`} value={result} checked={checked} onChange={() => onChange({ result })} className="sr-only" />
                                    <Icon aria-hidden className={cn("size-3.5 shrink-0 max-sm:hidden", checked ? TONE_TEXT[meta.tone] : "text-fg-subtle")} />
                                    {meta.label}
                                </label>
                            );
                        })}
                    </div>
                    {errors.result && (
                        <p id={`${idPrefix}-result-error`} className="text-[13px] font-medium text-danger-fg">
                            {errors.result}
                        </p>
                    )}
                </div>
                <div className="col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-3">
                    <label htmlFor={`${idPrefix}-note`} className="sr-only">
                        Kết quả cho {name}
                        {noteRequired ? "(bắt buộc khi bất thường)" : "(không bắt buộc)"}
                    </label>
                    <Input
                        id={`${idPrefix}-note`}
                        value={row.note}
                        onChange={(event) => onChange({ note: event.target.value })}
                        placeholder={noteRequired ? "Mô tả dấu hiệu bất thường (bắt buộc)" : "Kết quả (không bắt buộc)"}
                        aria-invalid={errors.note ? true : undefined}
                        aria-describedby={errors.note ? `${idPrefix}-note-error` : undefined}
                    />
                    {errors.note && (
                        <p id={`${idPrefix}-note-error`} className="text-[13px] font-medium text-danger-fg">
                            {errors.note}
                        </p>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Xóa ${name}`} className="col-start-2 row-start-1 lg:col-start-3">
                    <X />
                </Button>
            </div>
        </li>
    );
}

/* ─── Follow-up ───────────────────────────────────────────────────────────── */

const FOLLOW_UP_PICKS = [7, 14, 28];

/** An optional follow-up date after the examination day, with quick picks. */
export function FollowUpField({ form, examDay, value, onChange, hint }: { form: FormControls; examDay: string; value: string; onChange: (value: string) => void; hint: string }) {
    const control = form.control("followUpDate", { hint: true });
    return (
        <Field label="Khám theo dõi" htmlFor={control.id} error={form.error("followUpDate")} optional hint={hint} info={<TermHint term="followUpDate" />}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                    <Input {...control} type="date" value={value} min={examDay ? addDaysToKey(examDay, 1) : undefined} onChange={(event) => onChange(event.target.value)} />
                </div>
                {examDay &&
                    FOLLOW_UP_PICKS.map((days) => (
                        <Button key={days} variant="ghost" size="sm" onClick={() => onChange(addDaysToKey(examDay, days))}>
                            Sau {days === 7 ? "1 tuần" : `${days / 7} tuần`}
                        </Button>
                    ))}
                {value && (
                    <Button variant="ghost" size="sm" onClick={() => onChange("")}>
                        Xóa
                    </Button>
                )}
            </div>
        </Field>
    );
}
