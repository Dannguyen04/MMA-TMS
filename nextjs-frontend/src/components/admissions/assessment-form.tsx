"use client";

import { CircleCheck, CircleX, ListChecks, Plus, Ruler, Trash2, Undo2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { FormStep, FormSteps, type FormStepDefinition } from "@/components/ui/form-steps";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitAssessmentAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type AssessmentConclusion } from "@/lib/domain/admissions";
import { plural, type Translator } from "@/lib/i18n/translate";
import { appendLine, closingLines, draftAssessmentSummary, unusedPresets, type CriterionPreset } from "./assessment-presets";

interface CriterionRow {
    key: string;
    criterionName: string;
    method: string;
    observation: string;
    value: string;
    unit: string;
    note: string;
    /** The optional value, unit and note are open. */
    measured: boolean;
}

type RowField = Exclude<keyof CriterionRow, "key" | "measured">;

const newRow = (key: string, preset?: CriterionPreset): CriterionRow => ({
    key,
    criterionName: preset?.criterionName ?? "",
    method: preset?.method ?? "",
    observation: "",
    value: "",
    unit: "",
    note: "",
    measured: false,
});

const conclusions = (t: Translator): ChoiceOption<AssessmentConclusion>[] => [
    { value: "pass", label: t("screens.misc.conclusion.pass"), description: t("screens.misc.assessment.passDescription"), icon: CircleCheck, tone: "success" },
    { value: "fail", label: t("screens.misc.conclusion.fail"), description: t("screens.misc.admissions.closesCanReapply"), icon: CircleX, tone: "danger" },
];

const steps = (t: Translator): FormStepDefinition[] => [
    { id: "criteria", label: t("screens.misc.assessment.criteria"), description: t("screens.misc.assessment.criteriaDescription") },
    { id: "result", label: t("screens.misc.assessment.resultStep"), description: t("screens.misc.assessment.resultStepDescription") },
];

/**
 * The coach's entrance assessment in two steps: each thing they checked (common criteria are one tap away), then a
 * summary they can draft from their own observations and a pass or fail. The academy sets no universal pass mark,
 * so the criteria are the coach's own evidence. Nothing is sent until "Save assessment", and it can't be changed after.
 */
export function AssessmentForm({ applicationId, applicantName }: { applicationId: string; applicantName: string }) {
    const t = useT();
    const locale = useLocale();
    const toast = useToast();
    const form = useActionForm(submitAssessmentAction, {
        id: "assessment",
        hiddenFields: ["criteria"],
        onSuccess: (state) => toast({ tone: "success", title: state.message ?? t("screens.misc.assessment.saved") }),
    });
    const { conclusionOptions, stepList, closing } = useMemo(() => ({ conclusionOptions: conclusions(t), stepList: steps(t), closing: closingLines(locale) }), [t, locale]);
    const { control, error } = form;
    const baseId = useId();
    const [conclusion, setConclusion] = useState<AssessmentConclusion | "">("");
    // Keys come from a per-form counter, so rows render the same on the server and the client.
    const rowCount = useRef(0);
    const [rows, setRows] = useState<CriterionRow[]>([]);
    const [summary, setSummary] = useState("");
    const [beforeDraft, setBeforeDraft] = useState<string | null>(null);
    const [draftNote, setDraftNote] = useState("");

    // The control to focus once the rows it belongs to have rendered.
    const pendingFocus = useRef<string | null>(null);
    const focusAfterRender = (id: string) => {
        pendingFocus.current = id;
    };
    useEffect(() => {
        const id = pendingFocus.current;
        if (!id) return;
        pendingFocus.current = null;
        document.getElementById(id)?.focus();
    }, [rows]);

    const inputId = (row: CriterionRow, name: RowField) => `${baseId}-${row.key}-${name}`;
    /** Changes a row; `fields` are the edited controls, whose server errors then clear. */
    const update = (key: string, patch: Partial<CriterionRow>, ...fields: string[]) => {
        setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
        fields.forEach(form.markEdited);
    };
    const addRow = (preset?: CriterionPreset) => {
        if (rows.length >= ADMISSION_LIMITS.criteriaMax) return;
        const row = newRow(`c${rowCount.current++}`, preset);
        setRows((current) => [...current, row]);
        form.markEdited("criteria");
        // A preset fills the name and method, so the coach goes straight to what they saw.
        focusAfterRender(inputId(row, preset ? "observation" : "criterionName"));
    };
    const removeRow = (key: string) => {
        setRows((current) => current.filter((row) => row.key !== key));
        form.markEdited("criteria");
    };

    const writeSummary = (value: string) => {
        setSummary(value);
        setBeforeDraft(null);
        setDraftNote("");
        form.markEdited("summary");
    };
    const draft = draftAssessmentSummary(rows);
    const applyDraft = () => {
        const lines = draft.split("\n").length;
        setBeforeDraft(summary.trim() ? summary : null);
        setSummary(draft);
        setDraftNote(plural(t, "screens.misc.assessment.drafted", lines));
        form.markEdited("summary");
    };
    const undoDraft = () => {
        if (beforeDraft === null) return;
        writeSummary(beforeDraft);
    };

    const serialized = JSON.stringify(rows.map(({ criterionName, method, observation, value, unit, note }) => ({ criterionName, method, observation, value, unit, note })));
    const rowField = (row: CriterionRow, index: number, name: RowField) => ({
        id: inputId(row, name),
        value: row[name],
        onChange: (event: { target: { value: string } }) => update(row.key, { [name]: event.target.value }, `criteria.${index}.${name}`),
    });
    const rowError = (index: number, name: RowField) => error(`criteria.${index}.${name}`);
    const presets = unusedPresets(rows, locale);

    return (
        <form {...form.formProps}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="criteria" value={serialized} />

            <FormSteps
                steps={stepList}
                state={form.state}
                validateStep={(stepId) => (stepId === "criteria" && rows.length === 0 ? t("screens.misc.assessment.needCriterion") : null)}
                message={<FormMessage {...form.message} />}
                submit={
                    <SubmitButton size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" pending={form.pending} pendingLabel={t("screens.admin.common.saving")}>
                        {t("screens.misc.assessment.save")}
                    </SubmitButton>
                }
            >
                <FormStep
                    id="criteria"
                    description={
                        <span className="inline-flex flex-wrap items-center gap-1">
                            {t("screens.misc.assessment.addEach")}
                            <TermHint term="assessmentCriterion" />
                        </span>
                    }
                    className="flex flex-col gap-4"
                >
                    <SuggestionChips label={t("screens.misc.assessment.commonCriteria")} suggestions={presets} onPick={(_, picked) => addRow(presets.find((preset) => preset.label === picked.label))} disabled={rows.length >= ADMISSION_LIMITS.criteriaMax} />

                    {rows.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-fg-muted">
                            {t("screens.misc.assessment.nothingAdded")}
                        </p>
                    ) : (
                        <ol className="flex flex-col gap-3" aria-label={t("screens.misc.assessment.criteria")}>
                            {rows.map((row, index) => {
                                const title = row.criterionName.trim() || t("screens.misc.assessment.criterionN", { n: index + 1 });
                                const measurementError = rowError(index, "value") ?? rowError(index, "unit") ?? rowError(index, "note");
                                const showMeasurement = row.measured || Boolean(measurementError);
                                const forRow = <span className="sr-only">{t("screens.misc.assessment.forRow", { title })}</span>;
                                return (
                                    <li key={row.key} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="min-w-0 truncate font-display text-sm font-bold text-fg">{title}</p>
                                            <Button variant="ghost" size="icon-sm" aria-label={t("training.exerciseBuilder.remove", { name: title })} onClick={() => removeRow(row.key)}>
                                                <Trash2 aria-hidden />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <Field label={<>{t("screens.misc.assessment.criterion")}{forRow}</>} htmlFor={inputId(row, "criterionName")} required error={rowError(index, "criterionName")}>
                                                <Input {...rowField(row, index, "criterionName")} required maxLength={ADMISSION_LIMITS.criterionName} placeholder={t("screens.misc.assessment.criterionPlaceholder")} />
                                            </Field>
                                            <Field label={<>{t("screens.misc.assessment.method")}{forRow}</>} htmlFor={inputId(row, "method")} required error={rowError(index, "method")}>
                                                <Input {...rowField(row, index, "method")} required maxLength={ADMISSION_LIMITS.method} placeholder={t("screens.misc.assessment.methodPlaceholder")} />
                                            </Field>
                                        </div>
                                        <Field label={<>{t("screens.misc.assessment.observation")}{forRow}</>} htmlFor={inputId(row, "observation")} required error={rowError(index, "observation")}>
                                            <Textarea {...rowField(row, index, "observation")} required rows={2} maxLength={ADMISSION_LIMITS.observation} />
                                        </Field>
                                        {showMeasurement ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_160px_minmax(0,1fr)]">
                                                    <Field label={<>{t("screens.misc.assessment.value")}{forRow}</>} htmlFor={inputId(row, "value")} optional error={rowError(index, "value")}>
                                                        <Input {...rowField(row, index, "value")} type="number" step="any" inputMode="decimal" />
                                                    </Field>
                                                    <Field label={<>{t("screens.misc.assessment.unit")}{forRow}</>} htmlFor={inputId(row, "unit")} optional error={rowError(index, "unit")}>
                                                        <Input {...rowField(row, index, "unit")} maxLength={ADMISSION_LIMITS.unit} placeholder={t("screens.misc.assessment.unitPlaceholder")} />
                                                    </Field>
                                                    <Field label={<>{t("screens.misc.assessment.note")}{forRow}</>} htmlFor={inputId(row, "note")} optional error={rowError(index, "note")}>
                                                        <Input {...rowField(row, index, "note")} maxLength={ADMISSION_LIMITS.note} />
                                                    </Field>
                                                </div>
                                                <div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            update(row.key, { measured: false, value: "", unit: "", note: "" }, `criteria.${index}.value`, `criteria.${index}.unit`, `criteria.${index}.note`);
                                                            focusAfterRender(inputId(row, "observation"));
                                                        }}
                                                    >
                                                        {t("screens.misc.assessment.removeMeasurement")}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        update(row.key, { measured: true });
                                                        focusAfterRender(inputId(row, "value"));
                                                    }}
                                                >
                                                    <Ruler aria-hidden />
                                                    {t("screens.misc.assessment.addMeasurement")}
                                                </Button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                    {error("criteria") && <p className="text-[13px] font-medium text-danger-fg">{error("criteria")}</p>}
                    <div>
                        <Button variant="secondary" size="sm" disabled={rows.length >= ADMISSION_LIMITS.criteriaMax} onClick={() => addRow()}>
                            <Plus aria-hidden />
                            {t("screens.misc.assessment.addOwn")}
                        </Button>
                    </div>
                </FormStep>

                <FormStep id="result" className="flex flex-col gap-5">
                    <ChoiceGroup id={control("conclusion").id} name="conclusion" legend={t("screens.misc.assessment.result")} required columns={2} options={conclusionOptions} value={conclusion} onChange={setConclusion} error={error("conclusion")} />
                    <div className="flex flex-col gap-2">
                        <Field label={t("screens.misc.assessment.summary")} htmlFor={control("summary").id} required error={error("summary")}>
                            <Textarea
                                {...control("summary", { required: true })}
                                rows={5}
                                value={summary}
                                onChange={(event) => writeSummary(event.target.value)}
                                maxLength={ADMISSION_LIMITS.summary}
                                placeholder={t("screens.misc.assessment.summaryPlaceholder", { name: applicantName })}
                            />
                        </Field>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="secondary" size="sm" disabled={!draft} onClick={applyDraft}>
                                <ListChecks aria-hidden />
                                {t("screens.misc.assessment.draftSummary")}
                            </Button>
                            {beforeDraft !== null && (
                                <Button variant="ghost" size="sm" onClick={undoDraft}>
                                    <Undo2 aria-hidden />
                                    {t("screens.misc.assessment.undoDraft")}
                                </Button>
                            )}
                            <span aria-live="polite" className="text-[13px] text-fg-muted">
                                {draftNote || (!draft ? t("screens.misc.assessment.writeToDraft") : "")}
                            </span>
                        </div>
                        {conclusion && (
                            <SuggestionChips
                                label={t("screens.misc.assessment.closingLines")}
                                suggestions={closing[conclusion]}
                                onPick={(value) => {
                                    const next = appendLine(summary, value);
                                    if (next.length <= ADMISSION_LIMITS.summary) writeSummary(next);
                                }}
                            />
                        )}
                    </div>
                </FormStep>
            </FormSteps>
        </form>
    );
}
