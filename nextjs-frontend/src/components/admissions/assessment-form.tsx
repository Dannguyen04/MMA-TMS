"use client";

import { CircleCheck, CircleX, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitAssessmentAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type AssessmentConclusion } from "@/lib/domain/admissions";

interface CriterionRow {
    key: string;
    criterionName: string;
    method: string;
    observation: string;
    value: string;
    unit: string;
    note: string;
}

const emptyRow = (key: string): CriterionRow => ({ key, criterionName: "", method: "", observation: "", value: "", unit: "", note: "" });

const CONCLUSIONS: ChoiceOption<AssessmentConclusion>[] = [
    { value: "pass", label: "Pass", description: "An administrator makes the final decision.", icon: CircleCheck, tone: "success" },
    { value: "fail", label: "Fail", description: "The application closes. They can apply again later.", icon: CircleX, tone: "danger" },
];

/**
 * The coach's entrance assessment: each thing they checked, how and what they saw, then a conclusion. The academy
 * sets no universal pass mark, so the criteria are the coach's own evidence. It can't be changed once saved.
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
    // Keys come from a per-form counter, so the first row renders the same on the server and the client.
    const rowCount = useRef(1);
    const [rows, setRows] = useState<CriterionRow[]>(() => [emptyRow("c0")]);

    const update = (key: string, patch: Partial<CriterionRow>, field: string) => {
        setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
        form.markEdited(field);
    };
    const serialized = JSON.stringify(rows.map(({ criterionName, method, observation, value, unit, note }) => ({ criterionName, method, observation, value, unit, note })));
    const rowField = (row: CriterionRow, index: number, name: Exclude<keyof CriterionRow, "key">) => ({
        id: `${baseId}-${row.key}-${name}`,
        value: row[name],
        onChange: (event: { target: { value: string } }) => update(row.key, { [name]: event.target.value }, `criteria.${index}.${name}`),
    });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="criteria" value={serialized} />

            <fieldset className="flex min-w-0 flex-col gap-3">
                <legend className="mb-3 text-sm font-semibold text-fg">What you assessed</legend>
                <ol className="flex flex-col gap-3">
                    {rows.map((row, index) => (
                        <li key={row.key} className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-display text-sm font-bold text-fg">Criterion {index + 1}</p>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Remove criterion ${index + 1}`}
                                    disabled={rows.length === 1}
                                    onClick={() => {
                                        setRows((current) => current.filter((candidate) => candidate.key !== row.key));
                                        form.markEdited("criteria");
                                    }}
                                >
                                    <Trash2 aria-hidden />
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Field label="Criterion" htmlFor={`${baseId}-${row.key}-criterionName`} required error={error(`criteria.${index}.criterionName`)}>
                                    <Input {...rowField(row, index, "criterionName")} maxLength={ADMISSION_LIMITS.criterionName} placeholder="e.g. Conditioning" />
                                </Field>
                                <Field label="How you tested it" htmlFor={`${baseId}-${row.key}-method`} required error={error(`criteria.${index}.method`)}>
                                    <Input {...rowField(row, index, "method")} maxLength={ADMISSION_LIMITS.method} placeholder="e.g. Three 3-minute pad rounds" />
                                </Field>
                            </div>
                            <Field label="What you saw" htmlFor={`${baseId}-${row.key}-observation`} required error={error(`criteria.${index}.observation`)}>
                                <Textarea {...rowField(row, index, "observation")} rows={2} maxLength={ADMISSION_LIMITS.observation} />
                            </Field>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_160px_minmax(0,1fr)]">
                                <Field label="Value" htmlFor={`${baseId}-${row.key}-value`} optional error={error(`criteria.${index}.value`)}>
                                    <Input {...rowField(row, index, "value")} type="number" step="any" inputMode="decimal" />
                                </Field>
                                <Field label="Unit" htmlFor={`${baseId}-${row.key}-unit`} optional error={error(`criteria.${index}.unit`)}>
                                    <Input {...rowField(row, index, "unit")} maxLength={ADMISSION_LIMITS.unit} placeholder="e.g. rounds" />
                                </Field>
                                <Field label="Note" htmlFor={`${baseId}-${row.key}-note`} optional error={error(`criteria.${index}.note`)}>
                                    <Input {...rowField(row, index, "note")} maxLength={ADMISSION_LIMITS.note} />
                                </Field>
                            </div>
                        </li>
                    ))}
                </ol>
                {error("criteria") && <p className="text-[13px] font-medium text-danger-fg">{error("criteria")}</p>}
                <div>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={rows.length >= ADMISSION_LIMITS.criteriaMax}
                        onClick={() => {
                            const row = emptyRow(`c${rowCount.current++}`);
                            setRows((current) => [...current, row]);
                            form.markEdited("criteria");
                        }}
                    >
                        <Plus aria-hidden />
                        Add criterion
                    </Button>
                </div>
            </fieldset>

            <Field label="Summary" htmlFor={control("summary").id} required error={error("summary")}>
                <Textarea {...control("summary", { required: true })} rows={4} maxLength={ADMISSION_LIMITS.summary} placeholder={`Your overall view of ${applicantName}.`} />
            </Field>
            <ChoiceGroup id={control("conclusion").id} name="conclusion" legend="Conclusion" required columns={2} options={CONCLUSIONS} value={conclusion} onChange={setConclusion} error={error("conclusion")} />

            <FormMessage {...form.message} />
            <div className="flex justify-end">
                <SubmitButton pending={form.pending} pendingLabel="Saving…">
                    Save assessment
                </SubmitButton>
            </div>
        </form>
    );
}
