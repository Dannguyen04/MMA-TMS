"use client";

import { CheckCheck, CircleCheck, History, ListRestart, Plus, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { TONE_SOFT, TONE_TEXT } from "@/components/ui/tone";
import type { ActionForm } from "@/components/ui/use-action-form";
import { ASSESSMENT_RESULT_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { AssessmentResult, ExaminationType } from "@/lib/domain/types";
import { addDaysToKey } from "@/lib/format";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate-client";
import { cn } from "@/lib/utils";
import { ASSESSMENT_RESULT_META } from "./clinical-badges";
import {
    assessmentPresets,
    checkVitals,
    EXAMINATION_TYPE_HINTS,
    fillBlankVitals,
    FOLLOW_UP_DEFAULT_DAYS,
    localLabel,
    markUnmarkedNormal,
    unmarkedAreas,
    type VitalCheck,
} from "./examination-presets";
import { QuickFill } from "./quick-fill";

/**
 * What a doctor records at the visit, shared by the demo examination form and the medical service's examination form:
 * vitals with live athlete reference ranges, one row per area assessed, and a follow-up date.
 */

type FormControls = Pick<ActionForm<unknown>, "error" | "control" | "markEdited">;

type VitalField = "weightKg" | "restingHeartRate" | "bloodPressureSystolic" | "bloodPressureDiastolic" | "temperatureC" | "spo2Pct";

export type VitalsDraft = Record<VitalField | "hydration", string>;

const EXAMINATION_TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];

/** An examination type's name in the viewer's language. */
const typeLabel = (t: Translator, type: ExaminationType) => localLabel(t, `examinationType.${type}`, EXAMINATION_TYPE_LABELS[type]);

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
    const t = useT();
    return (
        <Field
            label={t("doctorMedical.details.typeLabel")}
            htmlFor={form.control("type").id}
            error={form.error("type")}
            required
            hint={value ? t(EXAMINATION_TYPE_HINTS[value]) : t("doctorMedical.details.typeHint")}
            info={<TermHint term="baselineExam" />}
            className={className}
        >
            <Select {...form.control("type", { hint: true, required: true })} value={value} onChange={(event) => onChange(event.target.value as ExaminationType | "")} className="sm:max-w-sm">
                <option value="">{t("doctorMedical.details.chooseType")}</option>
                {EXAMINATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                        {typeLabel(t, type)}
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
    /** The previous examination's readings: shown as placeholders, and copied into blank fields only when the doctor asks. */
    previous?: VitalsDraft | null;
    /** Names the previous examination on the strip above the readings, e.g. its type and date. */
    previousLabel?: ReactNode;
}

const HYDRATION_LABELS: Record<string, MessageKey> = { good: "doctorMedical.hydration.good", fair: "doctorMedical.hydration.fair", poor: "doctorMedical.hydration.poor" };
/** The previous readings as the strip shows them. */
const PREVIOUS_ITEMS: { label: MessageKey; read: (v: VitalsDraft, t: Translator) => string }[] = [
    { label: "doctorMedical.vitals.weight", read: (v) => (v.weightKg ? `${v.weightKg} kg` : "") },
    { label: "doctorMedical.vitals.heartRate", read: (v) => (v.restingHeartRate ? `${v.restingHeartRate} bpm` : "") },
    { label: "doctorMedical.vitals.bloodPressure", read: (v) => (v.bloodPressureSystolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "") },
    { label: "doctorMedical.vitals.temperature", read: (v) => (v.temperatureC ? `${v.temperatureC} °C` : "") },
    { label: "doctorMedical.vitals.spo2", read: (v) => (v.spo2Pct ? `${v.spo2Pct}%` : "") },
    { label: "doctorMedical.vitals.hydration", read: (v, t) => (HYDRATION_LABELS[v.hydration] ? t(HYDRATION_LABELS[v.hydration]) : "") },
];
const VITAL_NAMES: Record<keyof VitalsDraft, MessageKey> = {
    weightKg: "doctorMedical.vitalName.weightKg",
    restingHeartRate: "doctorMedical.vitalName.restingHeartRate",
    bloodPressureSystolic: "doctorMedical.vitalName.bloodPressureSystolic",
    bloodPressureDiastolic: "doctorMedical.vitalName.bloodPressureDiastolic",
    temperatureC: "doctorMedical.vitalName.temperatureC",
    spo2Pct: "doctorMedical.vitalName.spo2Pct",
    hydration: "doctorMedical.vitalName.hydration",
};

/** The seven readings, each checked against athlete reference ranges as it's typed. Out-of-range readings are flagged, never blocked. */
export function VitalsFields({ form, value, onChange, weightLimitKg, required, previous, previousLabel }: VitalsFieldsProps) {
    const t = useT();
    const { error } = form;
    const [fillNote, setFillNote] = useState<string>();
    const canFill = !!previous && fillBlankVitals(value, previous).filled.length > 0;
    const fillPrevious = () => {
        if (!previous) return;
        const { next, filled } = fillBlankVitals(value, previous);
        onChange(next);
        for (const key of filled) form.markEdited(key);
        setFillNote(t("doctorMedical.vitals.filledNote", { names: filled.map((key) => t(VITAL_NAMES[key])).join(", ") }));
    };
    const was = (name: keyof VitalsDraft) => (previous?.[name] ? t("doctorMedical.vitals.was", { value: previous[name] }) : undefined);
    const checks = checkVitals(t, value, weightLimitKg);
    const outOfRange = Object.values(checks).filter((check) => check?.status === "check").length;
    const set = (name: keyof VitalsDraft, next: string) => onChange({ ...value, [name]: next });
    const id = (name: string) => form.control(name).id;
    const bpRangeId = `${id("bp")}-range`;

    const vitalInput = (name: VitalField, label: string, unit: string, props: { step?: string; min?: number; max?: number }, check: VitalCheck | undefined, info?: ReactNode) => {
        const message = error(name);
        const hintId = `${id(name)}-range`;
        return (
            <Field
                label={
                    <>
                        {label}
                        <span className="sr-only"> ({unit})</span>
                    </>
                }
                htmlFor={id(name)}
                error={message}
                required={required}
                info={info}
            >
                <Input
                    {...form.control(name, { required })}
                    suffix={unit}
                    type="number"
                    inputMode="decimal"
                    value={value[name]}
                    onChange={(event) => set(name, event.target.value)}
                    step={props.step ?? "1"}
                    min={props.min}
                    max={props.max}
                    placeholder={was(name)}
                    aria-describedby={message ? `${id(name)}-error` : check ? hintId : undefined}
                />
                {!message && <RangeHint id={hintId} check={check ?? null} />}
            </Field>
        );
    };

    return (
        <>
            {previous && (
                <div className="grid gap-3 rounded-lg bg-surface-muted px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0 text-[13px] text-fg-muted">
                        <p>{previousLabel ?? t("doctorMedical.vitals.previous")}</p>
                        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            {PREVIOUS_ITEMS.map(({ label, read }) => {
                                const shown = read(previous, t);
                                return shown ? (
                                    <div key={label} className="flex gap-1.5">
                                        <dt className="text-fg-subtle">{t(label)}</dt>
                                        <dd className="font-semibold text-fg">{shown}</dd>
                                    </div>
                                ) : null;
                            })}
                        </dl>
                    </div>
                    <QuickFill label={t("doctorMedical.vitals.fillFromPrevious")} icon={History} available={canFill} note={fillNote} onClick={fillPrevious} className="sm:max-w-64" />
                </div>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {vitalInput("weightKg", t("doctorMedical.vitals.weight"), "kg", { step: "0.1", min: 35, max: 180 }, checks.weightKg)}
                {vitalInput("restingHeartRate", t("doctorMedical.vitals.heartRate"), "bpm", { min: 25, max: 150 }, checks.restingHeartRate, <TermHint term="restingHeartRate" />)}
                {vitalInput("temperatureC", t("doctorMedical.vitals.temperature"), "°C", { step: "0.1", min: 33, max: 42 }, checks.temperatureC, <TermHint term="bodyTemperature" />)}
                <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 xl:col-span-2">
                    <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fg">
                        {t("doctorMedical.vitals.bloodPressure")}
                        <span className="sr-only"> (mmHg)</span>
                        {required && (
                            <span className="ml-0.5 text-danger-fg" aria-hidden>
                                *
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[13px] font-normal text-fg-subtle">
                            {t("doctorMedical.vitals.systolicShort")} <TermHint term="systolicPressure" /> / {t("doctorMedical.vitals.diastolicShort")}{" "}
                            <TermHint term="diastolicPressure" />
                        </span>
                    </legend>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                        <BpInput
                            id={id("bloodPressureSystolic")}
                            name="bloodPressureSystolic"
                            label={t("doctorMedical.vitals.systolic")}
                            value={value.bloodPressureSystolic}
                            placeholder={was("bloodPressureSystolic")}
                            required={required}
                            error={error("bloodPressureSystolic")}
                            rangeId={bpRangeId}
                            onChange={(next) => set("bloodPressureSystolic", next)}
                        />
                        <span aria-hidden className="text-fg-subtle">
                            /
                        </span>
                        <BpInput
                            id={id("bloodPressureDiastolic")}
                            name="bloodPressureDiastolic"
                            label={t("doctorMedical.vitals.diastolic")}
                            value={value.bloodPressureDiastolic}
                            placeholder={was("bloodPressureDiastolic")}
                            required={required}
                            error={error("bloodPressureDiastolic")}
                            rangeId={bpRangeId}
                            onChange={(next) => set("bloodPressureDiastolic", next)}
                        />
                    </div>
                    <RangeHint id={bpRangeId} check={checks.bloodPressure} />
                </fieldset>
                {vitalInput("spo2Pct", t("doctorMedical.vitals.spo2"), "%", { min: 70, max: 100 }, checks.spo2Pct, <TermHint term="spo2" />)}
                <Field label={t("doctorMedical.vitals.hydration")} htmlFor={id("hydration")} error={error("hydration")} required={required} info={<TermHint term="hydration" />}>
                    <Select
                        {...form.control("hydration", { required })}
                        value={value.hydration}
                        onChange={(event) => set("hydration", event.target.value)}
                        aria-describedby={error("hydration") ? `${id("hydration")}-error` : checks.hydration ? `${id("hydration")}-range` : undefined}
                    >
                        <option value="">
                            {previous?.hydration
                                ? t("doctorMedical.vitals.chooseWas", { value: HYDRATION_LABELS[previous.hydration] ? t(HYDRATION_LABELS[previous.hydration]) : previous.hydration })
                                : t("doctorMedical.vitals.choose")}
                        </option>
                        <option value="good">{t("doctorMedical.hydration.good")}</option>
                        <option value="fair">{t("doctorMedical.hydration.fair")}</option>
                        <option value="poor">{t("doctorMedical.hydration.poor")}</option>
                    </Select>
                    {!error("hydration") && <RangeHint id={`${id("hydration")}-range`} check={checks.hydration} />}
                </Field>
            </div>
            <p aria-live="polite" className={cn("text-[13px]", outOfRange > 0 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                {outOfRange > 0 ? plural(t, "doctorMedical.vitals.outOfRange", outOfRange) : t("doctorMedical.vitals.allInRange")}
            </p>
        </>
    );
}

function RangeHint({ id, check }: { id: string; check: VitalCheck }) {
    const t = useT();
    if (!check) return null;
    const normal = check.status === "normal";
    return (
        <p id={id} className={cn("flex items-start gap-1 text-[13px]", normal ? "text-fg-subtle" : "font-medium text-warning-fg")}>
            {normal ? <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
            <span>
                <span className="sr-only">{normal ? t("doctorMedical.vitals.inRange") : t("doctorMedical.vitals.toCheck")}</span>
                {check.text}
            </span>
        </p>
    );
}

function BpInput({
    id,
    name,
    label,
    value,
    required,
    error,
    rangeId,
    placeholder,
    onChange,
}: {
    id: string;
    name: string;
    label: string;
    value: string;
    required: boolean;
    error?: string;
    rangeId: string;
    placeholder?: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            {/* The legend above names the pair; each input keeps its own name for screen readers. */}
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <Input
                id={id}
                name={name}
                suffix="mmHg"
                type="number"
                inputMode="numeric"
                min={40}
                max={220}
                required={required}
                value={value}
                placeholder={placeholder}
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

const presetRows = (t: Translator, type: ExaminationType | "", startKey: number): AssessmentRow[] =>
    (type ? assessmentPresets(t, type) : []).map((area, index) => ({ key: startKey + index, area, result: "", note: "" }));

/**
 * Assessment rows that start from the examination type's list. Until the doctor edits a row, changing the type swaps
 * the list; afterwards their rows stay and "Reset" brings the list back.
 */
export function useAssessmentRows(form: FormControls, initialType: ExaminationType | "") {
    const t = useT();
    const [rows, setRows] = useState<AssessmentRow[]>(() => presetRows(t, initialType, 0));
    const [edited, setEdited] = useState(false);
    const [nextKey, setNextKey] = useState(100);

    /** Adding, removing or reloading rows shifts their indexes, so every row error is stale. */
    const replace = (next: AssessmentRow[]) => {
        setRows(next);
        form.markEdited("assessments");
    };
    const loadPreset = (type: ExaminationType | "") => {
        replace(presetRows(t, type, nextKey));
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
    const t = useT();
    const idPrefix = form.control("assessment").id;
    const [note, setNote] = useState<string>();
    const unmarked = unmarkedAreas(rows.rows).length;
    const markNormal = () => {
        const filled = rows.markUnmarkedNormal();
        if (filled.length > 0) setNote(t("doctorMedical.assess.markedNote", { areas: filled.join(", ") }));
    };
    return (
        <>
            <input type="hidden" name="assessments" value={JSON.stringify(rows.rows.map(({ area, result, note }) => ({ area, result, note })))} />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-fg-muted">{type ? t("doctorMedical.assess.startingList", { type: typeLabel(t, type).toLowerCase() }) : t("doctorMedical.assess.chooseTypeFirst")}</p>
                {type && rows.edited && (
                    <Button variant="ghost" size="sm" onClick={() => rows.reset(type)}>
                        <ListRestart aria-hidden />
                        {t("doctorMedical.assess.reset", { type: typeLabel(t, type).toLowerCase() })}
                    </Button>
                )}
            </div>
            <QuickFill
                label={plural(t, "doctorMedical.assess.markNormal", unmarked)}
                icon={CheckCheck}
                available={unmarked > 0}
                note={note}
                onClick={markNormal}
            />
            {form.error("assessments") && <p className="text-[13px] font-medium text-danger-fg">{form.error("assessments")}</p>}
            <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
                {rows.rows.map((row, index) => (
                    <AssessmentRowEditor
                        key={row.key}
                        row={row}
                        index={index}
                        idPrefix={`${idPrefix}-${row.key}`}
                        errors={{
                            area: form.error(`assessments.${index}.area`) ?? (checkMissing && !row.area.trim() ? t("doctorMedical.assess.areaMissing") : undefined),
                            result: form.error(`assessments.${index}.result`) ?? (checkMissing && !row.result ? t("doctorMedical.assess.resultMissing") : undefined),
                            note: form.error(`assessments.${index}.note`) ?? (checkMissing && row.result === "abnormal" && !row.note.trim() ? t("doctorMedical.assess.noteMissing") : undefined),
                        }}
                        onChange={(patch) => rows.update(index, patch)}
                        onRemove={() => rows.remove(row.key)}
                    />
                ))}
            </ol>
            <Button variant="secondary" size="sm" className="self-start" onClick={rows.add}>
                <Plus aria-hidden />
                {t("doctorMedical.assess.add")}
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
    const t = useT();
    const name = row.area.trim() || t("doctorMedical.assess.rowName", { n: index + 1 });
    const noteRequired = row.result === "abnormal";
    return (
        <li className={cn("px-3 py-2.5", errors.area || errors.result || errors.note ? "bg-danger-soft/40" : "bg-surface")}>
            {/* One row per area on very wide screens (area, result, note, remove); below that the note takes its own line. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)_auto]">
                <div className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${idPrefix}-area`} className="sr-only">
                        {t("doctorMedical.assess.areaLabel", { n: index + 1 })}
                    </label>
                    <Input
                        id={`${idPrefix}-area`}
                        value={row.area}
                        onChange={(event) => onChange({ area: event.target.value })}
                        placeholder={t("doctorMedical.assess.areaPlaceholder")}
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
                        aria-label={t("doctorMedical.assess.resultFor", { name })}
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
                                    {t(`doctorMedical.result.${result}`)}
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
                <div className="col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-3 2xl:col-span-1 2xl:col-start-3 2xl:row-start-1">
                    <label htmlFor={`${idPrefix}-note`} className="sr-only">
                        {t("doctorMedical.assess.resultFor", { name })}
                        {noteRequired ? t("doctorMedical.assess.noteRequiredSr") : t("doctorMedical.assess.noteOptionalSr")}
                    </label>
                    <Input
                        id={`${idPrefix}-note`}
                        value={row.note}
                        onChange={(event) => onChange({ note: event.target.value })}
                        placeholder={noteRequired ? t("doctorMedical.assess.notePlaceholderRequired") : t("doctorMedical.assess.notePlaceholder")}
                        aria-invalid={errors.note ? true : undefined}
                        aria-describedby={errors.note ? `${idPrefix}-note-error` : undefined}
                    />
                    {errors.note && (
                        <p id={`${idPrefix}-note-error`} className="text-[13px] font-medium text-danger-fg">
                            {errors.note}
                        </p>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={onRemove} aria-label={t("doctorMedical.assess.remove", { name })} className="col-start-2 row-start-1 lg:col-start-3 2xl:col-start-4">
                    <X />
                </Button>
            </div>
        </li>
    );
}

/* ─── Follow-up ───────────────────────────────────────────────────────────── */

const FOLLOW_UP_PICKS = [7, 14, 28];

/** The starting follow-up date for an examination type, or "" when the type has none. */
export function defaultFollowUp(type: ExaminationType | "", examDay: string): string {
    const days = type ? FOLLOW_UP_DEFAULT_DAYS[type] : null;
    return days && examDay ? addDaysToKey(examDay, days) : "";
}

/**
 * The follow-up date, starting from the examination type's default and following the type until the doctor sets it
 * themself; after that their date stays.
 */
export function useFollowUpDate(initialType: ExaminationType | "", examDay: string) {
    const [value, setValue] = useState(() => defaultFollowUp(initialType, examDay));
    const [edited, setEdited] = useState(false);
    return {
        value,
        set: (next: string) => {
            setValue(next);
            setEdited(true);
        },
        typeChanged: (type: ExaminationType | "") => {
            if (!edited) setValue(defaultFollowUp(type, examDay));
        },
    };
}

/** An optional follow-up date after the examination day, with quick picks. */
export function FollowUpField({ form, examDay, value, onChange, hint }: { form: FormControls; examDay: string; value: string; onChange: (value: string) => void; hint: string }) {
    const t = useT();
    const control = form.control("followUpDate", { hint: true });
    return (
        <Field label={t("doctorMedical.followUp.label")} htmlFor={control.id} error={form.error("followUpDate")} optional hint={hint} info={<TermHint term="followUpDate" />}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                    <Input {...control} type="date" value={value} min={examDay ? addDaysToKey(examDay, 1) : undefined} onChange={(event) => onChange(event.target.value)} />
                </div>
                {examDay &&
                    FOLLOW_UP_PICKS.map((days) => (
                        <Button key={days} variant="ghost" size="sm" onClick={() => onChange(addDaysToKey(examDay, days))}>
                            {plural(t, "doctorMedical.followUp.after", days / 7)}
                        </Button>
                    ))}
                {value && (
                    <Button variant="ghost" size="sm" onClick={() => onChange("")}>
                        {t("doctorMedical.followUp.clear")}
                    </Button>
                )}
            </div>
        </Field>
    );
}
