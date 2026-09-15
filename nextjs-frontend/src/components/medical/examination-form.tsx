"use client";

import { CircleCheck, Info, ListRestart, Plus, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { TONE_SOFT, TONE_TEXT } from "@/components/ui/tone";
import { useActionForm } from "@/components/ui/use-action-form";
import { createExaminationAction } from "@/lib/actions/medical";
import { ASSESSMENT_RESULT_LABELS, CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { AssessmentResult, ExaminationOutcome, ExaminationType, Vitals } from "@/lib/domain/types";
import { addDaysToKey, formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
    ASSESSMENT_RESULT_META,
    CLEARANCE_LEVEL_FOR_OUTCOME,
    EXAMINATION_OUTCOME_DESCRIPTIONS,
    EXAMINATION_OUTCOME_META,
    ExaminationOutcomeBadge,
} from "./clinical-badges";
import { ASSESSMENT_PRESETS, EXAMINATION_TYPE_HINTS, checkVitals, type VitalCheck } from "./examination-presets";

export interface ExamFighterOption extends FighterIdentityData {
    id: string;
    weightLimitKg: number;
    clearanceState: ClearanceState;
    clearanceValidUntil: string | null;
    lastExamination: { date: string; type: ExaminationType; outcome: ExaminationOutcome; vitals: Vitals } | null;
}

export interface ExaminationFormProps {
    fighters: ExamFighterOption[];
    defaultFighterId: string;
    defaultType: ExaminationType | "";
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    defaultDateTime: string;
}

const TYPES = Object.keys(EXAMINATION_TYPE_LABELS) as ExaminationType[];
const OUTCOME_OPTIONS: ChoiceOption<ExaminationOutcome>[] = (Object.keys(EXAMINATION_OUTCOME_LABELS) as ExaminationOutcome[]).map((value) => ({
    value,
    label: EXAMINATION_OUTCOME_LABELS[value],
    description: EXAMINATION_OUTCOME_DESCRIPTIONS[value],
    icon: EXAMINATION_OUTCOME_META[value].icon,
    tone: EXAMINATION_OUTCOME_META[value].tone,
}));
const RESULTS = Object.keys(ASSESSMENT_RESULT_LABELS) as AssessmentResult[];
const FOLLOW_UP_PICKS = [7, 14, 28];

interface AssessmentRow {
    key: number;
    area: string;
    result: AssessmentResult | "";
    note: string;
}

type VitalField = "weightKg" | "restingHeartRate" | "bloodPressureSystolic" | "bloodPressureDiastolic" | "temperatureC" | "spo2Pct";

const presetRows = (type: ExaminationType | "", startKey: number): AssessmentRow[] =>
    (type ? ASSESSMENT_PRESETS[type] : []).map((area, index) => ({ key: startKey + index, area, result: "", note: "" }));

/** Records a medical examination: patient and visit, vitals with live reference ranges, assessments and outcome. */
export function ExaminationForm({ fighters, defaultFighterId, defaultType, defaultDateTime }: ExaminationFormProps) {
    const form = useActionForm(createExaminationAction, { id: "exam" });
    const id = (name: string) => `exam-${name}`;
    const { error } = form;

    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [type, setType] = useState<ExaminationType | "">(defaultType);
    const [date, setDate] = useState(defaultDateTime);
    const [vitals, setVitals] = useState<Record<VitalField, string> & { hydration: string }>({
        weightKg: "",
        restingHeartRate: "",
        bloodPressureSystolic: "",
        bloodPressureDiastolic: "",
        temperatureC: "",
        spo2Pct: "",
        hydration: "",
    });
    const [rows, setRows] = useState<AssessmentRow[]>(() => presetRows(defaultType, 0));
    const [rowsEdited, setRowsEdited] = useState(false);
    const [nextKey, setNextKey] = useState(100);
    const [outcome, setOutcome] = useState<ExaminationOutcome | "">("");
    const [summary, setSummary] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const checks = checkVitals(vitals, fighter?.weightLimitKg ?? null);
    const outOfRange = Object.values(checks).filter((check) => check?.status === "check").length;
    const examDay = date.slice(0, 10);

    /** Adding, removing or reloading rows shifts their indexes, so every row error is stale. */
    const replaceRows = (next: AssessmentRow[]) => {
        setRows(next);
        form.markEdited("assessments");
    };

    const changeType = (next: ExaminationType | "") => {
        setType(next);
        if (!rowsEdited) {
            replaceRows(presetRows(next, nextKey));
            setNextKey((key) => key + 10);
        }
    };

    const applyTemplate = () => {
        replaceRows(presetRows(type, nextKey));
        setNextKey((key) => key + 10);
        setRowsEdited(false);
    };

    const updateRow = (index: number, patch: Partial<AssessmentRow>) => {
        setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
        Object.keys(patch).forEach((field) => form.markEdited(`assessments.${index}.${field}`));
        setRowsEdited(true);
    };

    const vitalInput = (name: VitalField, label: string, unit: string, props: { step?: string; min?: number; max?: number }, check: VitalCheck | undefined) => {
        const message = error(name);
        const hintId = `${id(name)}-range`;
        return (
            <Field label={`${label} (${unit})`} htmlFor={id(name)} error={message} required>
                <Input
                    {...form.control(name, { required: true })}
                    type="number"
                    inputMode="decimal"
                    value={vitals[name]}
                    onChange={(event) => setVitals((current) => ({ ...current, [name]: event.target.value }))}
                    step={props.step ?? "1"}
                    min={props.min}
                    max={props.max}
                    aria-describedby={message ? `${id(name)}-error` : check ? hintId : undefined}
                />
                {!message && <RangeHint id={hintId} check={check ?? null} />}
            </Field>
        );
    };

    const currentLevel = fighter && (fighter.clearanceState === "full" || fighter.clearanceState === "restricted" || fighter.clearanceState === "not_cleared") ? fighter.clearanceState : null;
    const outcomeMismatch = fighter && outcome ? currentLevel !== CLEARANCE_LEVEL_FOR_OUTCOME[outcome] : false;

    return (
        <form {...form.formProps}>
            <input type="hidden" name="assessments" value={JSON.stringify(rows.map(({ area, result, note }) => ({ area, result, note })))} />
            <Card className="px-5 py-6 sm:px-6">
                <FormSection title="Patient & visit" description="Who you examined, what kind of examination it was, and when.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Fighter" htmlFor={id("fighterId")} error={error("fighterId")} required>
                            <Select {...form.control("fighterId", { required: true })} value={fighterId} onChange={(event) => setFighterId(event.target.value)}>
                                <option value="">Choose a fighter…</option>
                                {fighters.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Date and time" htmlFor={id("date")} error={error("date")} required hint="Academy time (Ho Chi Minh City)">
                            <Input
                                {...form.control("date", { hint: true, required: true })}
                                type="datetime-local"
                                value={date}
                                max={defaultDateTime}
                                onChange={(event) => setDate(event.target.value)}
                            />
                        </Field>
                        <Field
                            label="Examination type"
                            htmlFor={id("type")}
                            error={error("type")}
                            required
                            hint={type ? EXAMINATION_TYPE_HINTS[type] : "The type sets a starting list of assessments."}
                            className="sm:col-span-2"
                        >
                            <Select
                                {...form.control("type", { hint: true, required: true })}
                                value={type}
                                onChange={(event) => changeType(event.target.value as ExaminationType | "")}
                                className="sm:max-w-sm"
                            >
                                <option value="">Choose a type…</option>
                                {TYPES.map((value) => (
                                    <option key={value} value={value}>
                                        {EXAMINATION_TYPE_LABELS[value]}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    <PatientContext fighter={fighter} />
                </FormSection>

                <FormSection
                    title="Vitals"
                    description="Reference ranges update as you type. Readings outside them are flagged for a recheck, not blocked."
                >
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {vitalInput("weightKg", "Weight", "kg", { step: "0.1", min: 35, max: 180 }, checks.weightKg)}
                        {vitalInput("restingHeartRate", "Resting heart rate", "bpm", { min: 25, max: 150 }, checks.restingHeartRate)}
                        {vitalInput("temperatureC", "Temperature", "°C", { step: "0.1", min: 33, max: 42 }, checks.temperatureC)}
                        <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 xl:col-span-2">
                            <legend className="mb-1.5 text-sm font-medium text-fg">
                                Blood pressure (mmHg)
                                <span className="ml-0.5 text-danger-fg" aria-hidden>
                                    *
                                </span>
                            </legend>
                            <div className="grid grid-cols-2 gap-3">
                                <BpInput
                                    id={id("bloodPressureSystolic")}
                                    name="bloodPressureSystolic"
                                    label="Systolic"
                                    value={vitals.bloodPressureSystolic}
                                    error={error("bloodPressureSystolic")}
                                    rangeId={`${id("bp")}-range`}
                                    onChange={(value) => setVitals((current) => ({ ...current, bloodPressureSystolic: value }))}
                                />
                                <BpInput
                                    id={id("bloodPressureDiastolic")}
                                    name="bloodPressureDiastolic"
                                    label="Diastolic"
                                    value={vitals.bloodPressureDiastolic}
                                    error={error("bloodPressureDiastolic")}
                                    rangeId={`${id("bp")}-range`}
                                    onChange={(value) => setVitals((current) => ({ ...current, bloodPressureDiastolic: value }))}
                                />
                            </div>
                            <RangeHint id={`${id("bp")}-range`} check={checks.bloodPressure} />
                        </fieldset>
                        {vitalInput("spo2Pct", "SpO₂", "%", { min: 70, max: 100 }, checks.spo2Pct)}
                        <Field label="Hydration" htmlFor={id("hydration")} error={error("hydration")} required>
                            <Select
                                {...form.control("hydration", { required: true })}
                                value={vitals.hydration}
                                onChange={(event) => setVitals((current) => ({ ...current, hydration: event.target.value }))}
                                aria-describedby={error("hydration") ? `${id("hydration")}-error` : checks.hydration ? `${id("hydration")}-range` : undefined}
                            >
                                <option value="">Choose…</option>
                                <option value="good">Good</option>
                                <option value="fair">Fair</option>
                                <option value="poor">Poor</option>
                            </Select>
                            {!error("hydration") && <RangeHint id={`${id("hydration")}-range`} check={checks.hydration} />}
                        </Field>
                    </div>
                    <p aria-live="polite" className={cn("text-[13px]", outOfRange > 0 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                        {outOfRange > 0
                            ? `${outOfRange} ${outOfRange === 1 ? "reading is" : "readings are"} outside the athlete reference range — consider rechecking.`
                            : "All entered readings are within reference ranges."}
                    </p>
                </FormSection>

                <FormSection
                    title="Assessments"
                    description="One row per area examined. Describe every abnormal finding so the record is useful at follow-up."
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] text-fg-muted">
                            {type ? `Starting list for ${EXAMINATION_TYPE_LABELS[type].toLowerCase()}.` : "Choose an examination type to load a starting list."}
                        </p>
                        {type && rowsEdited && (
                            <Button variant="ghost" size="sm" onClick={applyTemplate}>
                                <ListRestart aria-hidden />
                                Reset to {EXAMINATION_TYPE_LABELS[type].toLowerCase()} list
                            </Button>
                        )}
                    </div>
                    {error("assessments") && <p className="text-[13px] font-medium text-danger-fg">{error("assessments")}</p>}
                    <ol className="flex flex-col gap-3">
                        {rows.map((row, index) => (
                            <AssessmentRowEditor
                                key={row.key}
                                row={row}
                                index={index}
                                idPrefix={id(`assessment-${row.key}`)}
                                errors={{
                                    area: error(`assessments.${index}.area`),
                                    result: error(`assessments.${index}.result`),
                                    note: error(`assessments.${index}.note`),
                                }}
                                onChange={(patch) => updateRow(index, patch)}
                                onRemove={() => {
                                    replaceRows(rows.filter((candidate) => candidate.key !== row.key));
                                    setRowsEdited(true);
                                }}
                            />
                        ))}
                    </ol>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                            replaceRows([...rows, { key: nextKey, area: "", result: "", note: "" }]);
                            setNextKey((key) => key + 1);
                            setRowsEdited(true);
                        }}
                    >
                        <Plus aria-hidden />
                        Add assessment
                    </Button>
                </FormSection>

                <FormSection title="Outcome & plan" description="Your conclusion, what the fighter and staff should do next, and when to review.">
                    <div>
                        <ChoiceGroup
                            id={id("outcome")}
                            name="outcome"
                            legend="Outcome"
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
                                        ? `This outcome points to “${CLEARANCE_LEVEL_LABELS[CLEARANCE_LEVEL_FOR_OUTCOME[outcome]]}”, but ${fighter.name}'s clearance is currently ${currentLevel ? `“${CLEARANCE_LEVEL_LABELS[currentLevel]}”` : fighter.clearanceState === "expired" ? "expired" : "not on file"}. Saving doesn't change the clearance — you'll be offered an update next.`
                                        : "Consistent with the current Medical Clearance."}
                                </InlineNote>
                            )}
                        </div>
                    </div>

                    <Field label="Summary of findings" htmlFor={id("summary")} error={error("summary")} required hint="Visible to the fighter on their Health page.">
                        <Textarea {...form.control("summary", { hint: true, required: true })} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
                    </Field>
                    <Field label="Recommendations" htmlFor={id("recommendations")} error={error("recommendations")} required hint="Training guidance, treatment and next steps.">
                        <Textarea
                            {...form.control("recommendations", { hint: true, required: true })}
                            rows={3}
                            value={recommendations}
                            onChange={(event) => setRecommendations(event.target.value)}
                        />
                    </Field>
                    <Field label="Follow-up examination" htmlFor={id("followUpDate")} error={error("followUpDate")} optional hint="Appears on your dashboard as the date approaches.">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-44">
                                <Input
                                    {...form.control("followUpDate", { hint: true })}
                                    type="date"
                                    value={followUpDate}
                                    min={examDay ? addDaysToKey(examDay, 1) : undefined}
                                    onChange={(event) => setFollowUpDate(event.target.value)}
                                />
                            </div>
                            {examDay &&
                                FOLLOW_UP_PICKS.map((days) => (
                                    <Button key={days} variant="ghost" size="sm" onClick={() => setFollowUpDate(addDaysToKey(examDay, days))}>
                                        In {days === 7 ? "1 week" : `${days / 7} weeks`}
                                    </Button>
                                ))}
                            {followUpDate && (
                                <Button variant="ghost" size="sm" onClick={() => setFollowUpDate("")}>
                                    Clear
                                </Button>
                            )}
                        </div>
                    </Field>
                </FormSection>

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <FormMessage {...form.message} />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link href={routes.doctor.examinations} className={buttonClasses({ variant: "secondary" })}>
                            Cancel
                        </Link>
                        <Button type="submit" loading={form.pending}>
                            {form.pending ? "Saving examination…" : "Save examination"}
                        </Button>
                    </div>
                </div>
            </Card>
        </form>
    );
}

function RangeHint({ id, check }: { id: string; check: VitalCheck }) {
    if (!check) return null;
    const normal = check.status === "normal";
    return (
        <p id={id} className={cn("flex items-start gap-1 text-[13px]", normal ? "text-fg-subtle" : "font-medium text-warning-fg")}>
            {normal ? <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
            <span>
                <span className="sr-only">{normal ? "Within range: " : "Check: "}</span>
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
    error,
    rangeId,
    onChange,
}: {
    id: string;
    name: string;
    label: string;
    value: string;
    error?: string;
    rangeId: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={id} className="text-xs text-fg-muted">
                {label}
            </label>
            <Input
                id={id}
                name={name}
                type="number"
                inputMode="numeric"
                min={40}
                max={220}
                required
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
    const name = row.area.trim() || `assessment ${index + 1}`;
    const noteRequired = row.result === "abnormal";
    return (
        <li className={cn("rounded-lg border bg-surface-muted/50 p-3", errors.area || errors.result || errors.note ? "border-danger-border" : "border-border")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${idPrefix}-area`} className="sr-only">
                        Area assessed, row {index + 1}
                    </label>
                    <Input
                        id={`${idPrefix}-area`}
                        value={row.area}
                        onChange={(event) => onChange({ area: event.target.value })}
                        placeholder="Area assessed, e.g. Hawkins–Kennedy"
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
                        aria-label={`Result for ${name}`}
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
                                    <input
                                        type="radio"
                                        name={`${idPrefix}-result`}
                                        value={result}
                                        checked={checked}
                                        onChange={() => onChange({ result })}
                                        className="sr-only"
                                    />
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
                        Findings for {name}
                        {noteRequired ? " (required for abnormal results)" : " (optional)"}
                    </label>
                    <Input
                        id={`${idPrefix}-note`}
                        value={row.note}
                        onChange={(event) => onChange({ note: event.target.value })}
                        placeholder={noteRequired ? "Describe the abnormal finding (required)" : "Findings (optional)"}
                        aria-invalid={errors.note ? true : undefined}
                        aria-describedby={errors.note ? `${idPrefix}-note-error` : undefined}
                    />
                    {errors.note && (
                        <p id={`${idPrefix}-note-error`} className="text-[13px] font-medium text-danger-fg">
                            {errors.note}
                        </p>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${name}`} className="col-start-2 row-start-1 lg:col-start-3">
                    <X />
                </Button>
            </div>
        </li>
    );
}

function PatientContext({ fighter }: { fighter: ExamFighterOption | null }) {
    if (!fighter) {
        return <p className="rounded-lg bg-surface-muted px-4 py-3 text-[13px] text-fg-muted">Choose a fighter to see their current clearance and last examination.</p>;
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
                        Clearance {fighter.clearanceState === "expired" ? "expired" : "valid until"} {formatDate(fighter.clearanceValidUntil)}
                    </p>
                )}
            </div>
            <div className="min-w-0 text-[13px]">
                {last ? (
                    <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
                            Last examination: <span className="font-medium text-fg">{EXAMINATION_TYPE_LABELS[last.type]}</span>
                            <span>{formatDate(last.date)}</span>
                            <ExaminationOutcomeBadge outcome={last.outcome} size="sm" />
                        </p>
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
                            <div className="flex gap-1">
                                <dt>Weight</dt>
                                <dd className="font-medium text-fg">{formatNumber(last.vitals.weightKg, 1)} kg</dd>
                            </div>
                            <div className="flex gap-1">
                                <dt>Resting HR</dt>
                                <dd className="font-medium text-fg">{last.vitals.restingHeartRate} bpm</dd>
                            </div>
                            <div className="flex gap-1">
                                <dt>BP</dt>
                                <dd className="font-medium text-fg">
                                    {last.vitals.bloodPressureSystolic}/{last.vitals.bloodPressureDiastolic}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt>Class limit</dt>
                                <dd className="font-medium text-fg">{formatNumber(fighter.weightLimitKg, 1)} kg</dd>
                            </div>
                        </dl>
                    </>
                ) : (
                    <p className="text-fg-muted">No previous examinations — this will be their first. A baseline physical is recommended.</p>
                )}
            </div>
        </div>
    );
}
