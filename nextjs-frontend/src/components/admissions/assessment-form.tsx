"use client";

import { CircleCheck, CircleX, ListChecks, Plus, Ruler, Trash2, Undo2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { TermHint } from "@/components/domain/term-hint";
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
import { CLOSING_LINES, appendLine, draftAssessmentSummary, unusedPresets, type CriterionPreset } from "./assessment-presets";

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

const CONCLUSIONS: ChoiceOption<AssessmentConclusion>[] = [
    { value: "pass", label: "Pass", description: "An administrator makes the final decision.", icon: CircleCheck, tone: "success" },
    { value: "fail", label: "Fail", description: "The application closes. They can apply again later.", icon: CircleX, tone: "danger" },
];

const STEPS: FormStepDefinition[] = [
    { id: "criteria", label: "Criteria", description: "What you checked and saw" },
    { id: "result", label: "Summary & result", description: "Your overall view, pass or fail" },
];

/**
 * The coach's entrance assessment in two steps: each thing they checked (common criteria are one tap away), then a
 * summary they can draft from their own observations and a pass or fail. The academy sets no universal pass mark,
 * so the criteria are the coach's own evidence. Nothing is sent until "Save assessment", and it can't be changed after.
 */
export function AssessmentForm({ applicationId, applicantName }: { applicationId: string; applicantName: string }) {
    const toast = useToast();
    const form = useActionForm(submitAssessmentAction, {
        id: "assessment",
        hiddenFields: ["criteria"],
        onSuccess: (state) => toast({ tone: "success", title: state.message ?? "Assessment saved." }),
    });
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
        setDraftNote(`Drafted from ${lines === 1 ? "1 observation" : `${lines} observations`}. Edit it before you save.`);
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
    const presets = unusedPresets(rows);

    return (
        <form {...form.formProps}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="criteria" value={serialized} />

            <FormSteps
                steps={STEPS}
                state={form.state}
                validateStep={(stepId) => (stepId === "criteria" && rows.length === 0 ? "Add at least one criterion to continue." : null)}
                message={<FormMessage {...form.message} />}
                submit={
                    <SubmitButton size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" pending={form.pending} pendingLabel="Saving…">
                        Save assessment
                    </SubmitButton>
                }
            >
                <FormStep
                    id="criteria"
                    description={
                        <span className="inline-flex flex-wrap items-center gap-1">
                            Add each thing you checked, then write what you saw.
                            <TermHint term="assessmentCriterion" />
                        </span>
                    }
                    className="flex flex-col gap-4"
                >
                    <SuggestionChips label="Common criteria" suggestions={presets} onPick={(_, picked) => addRow(presets.find((preset) => preset.label === picked.label))} disabled={rows.length >= ADMISSION_LIMITS.criteriaMax} />

                    {rows.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-fg-muted">
                            Nothing added yet. Pick a common criterion above, or add your own.
                        </p>
                    ) : (
                        <ol className="flex flex-col gap-3" aria-label="Criteria">
                            {rows.map((row, index) => {
                                const title = row.criterionName.trim() || `Criterion ${index + 1}`;
                                const measurementError = rowError(index, "value") ?? rowError(index, "unit") ?? rowError(index, "note");
                                const showMeasurement = row.measured || Boolean(measurementError);
                                const forRow = <span className="sr-only"> for {title}</span>;
                                return (
                                    <li key={row.key} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="min-w-0 truncate font-display text-sm font-bold text-fg">{title}</p>
                                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${title}`} onClick={() => removeRow(row.key)}>
                                                <Trash2 aria-hidden />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <Field label={<>Criterion{forRow}</>} htmlFor={inputId(row, "criterionName")} required error={rowError(index, "criterionName")}>
                                                <Input {...rowField(row, index, "criterionName")} required maxLength={ADMISSION_LIMITS.criterionName} placeholder="e.g. Conditioning" />
                                            </Field>
                                            <Field label={<>How you tested it{forRow}</>} htmlFor={inputId(row, "method")} required error={rowError(index, "method")}>
                                                <Input {...rowField(row, index, "method")} required maxLength={ADMISSION_LIMITS.method} placeholder="e.g. Three 3-minute pad rounds" />
                                            </Field>
                                        </div>
                                        <Field label={<>What you saw{forRow}</>} htmlFor={inputId(row, "observation")} required error={rowError(index, "observation")}>
                                            <Textarea {...rowField(row, index, "observation")} required rows={2} maxLength={ADMISSION_LIMITS.observation} />
                                        </Field>
                                        {showMeasurement ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_160px_minmax(0,1fr)]">
                                                    <Field label={<>Value{forRow}</>} htmlFor={inputId(row, "value")} optional error={rowError(index, "value")}>
                                                        <Input {...rowField(row, index, "value")} type="number" step="any" inputMode="decimal" />
                                                    </Field>
                                                    <Field label={<>Unit{forRow}</>} htmlFor={inputId(row, "unit")} optional error={rowError(index, "unit")}>
                                                        <Input {...rowField(row, index, "unit")} maxLength={ADMISSION_LIMITS.unit} placeholder="e.g. rounds" />
                                                    </Field>
                                                    <Field label={<>Note{forRow}</>} htmlFor={inputId(row, "note")} optional error={rowError(index, "note")}>
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
                                                        Remove measurement
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
                                                    Add measurement
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
                            Add your own criterion
                        </Button>
                    </div>
                </FormStep>

                <FormStep id="result" className="flex flex-col gap-5">
                    <ChoiceGroup id={control("conclusion").id} name="conclusion" legend="Result" required columns={2} options={CONCLUSIONS} value={conclusion} onChange={setConclusion} error={error("conclusion")} />
                    <div className="flex flex-col gap-2">
                        <Field label="Summary" htmlFor={control("summary").id} required error={error("summary")}>
                            <Textarea
                                {...control("summary", { required: true })}
                                rows={5}
                                value={summary}
                                onChange={(event) => writeSummary(event.target.value)}
                                maxLength={ADMISSION_LIMITS.summary}
                                placeholder={`Your overall view of ${applicantName}.`}
                            />
                        </Field>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="secondary" size="sm" disabled={!draft} onClick={applyDraft}>
                                <ListChecks aria-hidden />
                                Draft summary from observations
                            </Button>
                            {beforeDraft !== null && (
                                <Button variant="ghost" size="sm" onClick={undoDraft}>
                                    <Undo2 aria-hidden />
                                    Undo draft
                                </Button>
                            )}
                            <span aria-live="polite" className="text-[13px] text-fg-muted">
                                {draftNote || (!draft ? "Write what you saw for a criterion to draft from it." : "")}
                            </span>
                        </div>
                        {conclusion && (
                            <SuggestionChips
                                label="Closing lines"
                                suggestions={CLOSING_LINES[conclusion]}
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
