"use client";

import { CalendarRange, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Term, TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormFooter, FormSection, Input, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { issueClearanceAction } from "@/lib/actions/medical-contract";
import {
    CLEARANCE_TYPES_BY_SCOPE,
    CLEARANCE_TYPE_LABELS,
    EXAMINATION_DECISION_LABELS,
    EXAMINATION_SCOPE_LABELS,
    MEDICAL_TEXT_LIMITS,
    type ClearanceType,
} from "@/lib/domain/medical-contract";
import { clearanceFromExamination, RECONCILE_FIELD, suggestClearanceType, type ClearanceTypeSuggestion } from "@/lib/domain/medical-flow";
import type { GlossaryTerm } from "@/lib/domain/glossary";
import type { MedicalClearance } from "@/lib/domain/types";
import { dayKey, formatDate } from "@/lib/format";
import type { CurrentExamination } from "@/lib/services/medical";
import { ExaminationReadBack } from "./examination-read-back";
import { RestrictionFields } from "./restriction-fields";

export interface IssueClearanceFormProps {
    fighter: { id: string; name: string };
    /** The fighter's current positive examinations, one per scope at most. */
    examinations: CurrentExamination[];
    /** Clearances in force, to show one already issued instead of issuing a duplicate. */
    activeClearances: MedicalClearance[];
    /** How many injuries are active or recovering, for the clearance type to suggest. */
    activeInjuries: number;
    defaultExaminationId: string;
    /** The fighter's class limit, for reading the vitals back. */
    weightLimitKg: number | null;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    cancelHref: string;
    /** Where the fighter's clearances are listed. */
    clearancesHref: string;
}

const CLEARANCE_TYPE_DESCRIPTIONS: Record<ClearanceType, string> = {
    TRAINING: "Routine training clearance.",
    RETURN_FROM_INJURY: "Back to training after an injury, usually with limits.",
    COMPETITION: "Clears the fighter to compete in a bout.",
};

const CLEARANCE_TYPE_TERMS: Record<ClearanceType, GlossaryTerm> = {
    TRAINING: "trainingClearance",
    RETURN_FROM_INJURY: "returnFromInjury",
    COMPETITION: "competitionClearance",
};

/** The type to start with: the suggestion when it may be selected for the doctor, the only type a scope allows, or none. */
function startingType(exam: CurrentExamination | null, suggestion: ClearanceTypeSuggestion | null): ClearanceType | "" {
    if (!exam) return "";
    const types = CLEARANCE_TYPES_BY_SCOPE[exam.scope];
    if (suggestion?.preselect && types.includes(suggestion.type)) return suggestion.type;
    return types.length === 1 ? types[0] : "";
}

/**
 * Step 2 of 2: issues a clearance from the fighter's current positive examination, read back from the medical service
 * first. The type is selected for the doctor only for a training baseline with no active injury; otherwise it's
 * suggested and the doctor picks. Dates and limits come from the examination and can only be narrowed. If the service
 * doesn't confirm, the record is checked before anything is sent again, and only the clearance is retried.
 */
export function IssueClearanceForm({ fighter, examinations, activeClearances, activeInjuries, defaultExaminationId, weightLimitKg, today, cancelHref, clearancesHref }: IssueClearanceFormProps) {
    const form = useActionForm(issueClearanceAction, { id: "issue-clearance" });
    const { control, error } = form;
    const suggestionFor = (exam: CurrentExamination | null) => (exam ? suggestClearanceType({ scope: exam.scope, examinationType: exam.details?.type ?? null, activeInjuries }) : null);
    const [examinationId, setExaminationId] = useState(examinations.find((exam) => exam.id === defaultExaminationId)?.id ?? examinations[0]?.id ?? "");
    const exam = examinations.find((candidate) => candidate.id === examinationId) ?? null;
    const suggestion = suggestionFor(exam);
    const [clearanceType, setClearanceType] = useState<ClearanceType | "">(() => startingType(exam, suggestion));
    const [changeDates, setChangeDates] = useState(false);
    const types = exam ? CLEARANCE_TYPES_BY_SCOPE[exam.scope] : [];
    const issued = exam && clearanceType ? clearanceFromExamination(activeClearances, exam.id, clearanceType) : null;
    const existing = form.state.status === "error" ? form.state.data?.existingClearance : undefined;
    const unconfirmed = form.state.status === "error" && form.state.data?.unconfirmed === true;
    const shownExisting = existing ?? (issued && clearanceType ? { clearanceType: issued.clearanceType ?? clearanceType, issuedAt: issued.issuedAt, validUntil: issued.validUntil } : null);
    const examDay = exam ? dayKey(exam.examinedAt) : today;
    const examLastDay = exam?.validUntil ? dayKey(exam.validUntil) : undefined;

    const examOptions: ChoiceOption<string>[] = examinations.map((candidate) => ({
        value: candidate.id,
        label: `${EXAMINATION_SCOPE_LABELS[candidate.scope]} — ${EXAMINATION_DECISION_LABELS[candidate.decision]}`,
        description: `Examined ${formatDate(candidate.examinedAt)}${candidate.validUntil ? ` · valid until ${formatDate(candidate.validUntil)}` : ""}`,
    }));
    const typeOptions: ChoiceOption<ClearanceType>[] = types.map((value) => ({
        value,
        label: CLEARANCE_TYPE_LABELS[value],
        description: CLEARANCE_TYPE_DESCRIPTIONS[value],
        extra:
            suggestion?.type === value && types.length > 1 ? (
                <Badge tone="info" size="sm" className="mt-1.5">
                    Suggested
                </Badge>
            ) : undefined,
    }));

    return (
        <div className="flex flex-col gap-6">
            {exam && <ExaminationReadBack exam={exam} weightLimitKg={weightLimitKg} />}

            <form {...form.formProps}>
                <Card className="min-w-0 px-5 py-6 sm:px-6">
                    <input type="hidden" name="fighterId" value={fighter.id} />
                    {unconfirmed && <input type="hidden" name={RECONCILE_FIELD} value="1" />}

                    {examinations.length > 1 ? (
                        <FormSection title="Examination" description="A clearance comes from the current positive examination of its scope.">
                            <ChoiceGroup
                                id="issue-clearance-exam"
                                name="examinationId"
                                legend="Examination"
                                legendVisuallyHidden
                                required
                                variant="compact"
                                options={examOptions}
                                value={examinationId}
                                onChange={(next) => {
                                    setExaminationId(next);
                                    const nextExam = examinations.find((candidate) => candidate.id === next) ?? null;
                                    setClearanceType(startingType(nextExam, suggestionFor(nextExam)));
                                    setChangeDates(false);
                                }}
                                error={error("examinationId")}
                            />
                        </FormSection>
                    ) : (
                        exam && <input type="hidden" name="examinationId" value={exam.id} />
                    )}

                    {exam && (
                        <>
                            <FormSection title="Clearance" info={<TermHint term="medicalClearance" />} description="What it clears the fighter for, and when.">
                                <ChoiceGroup
                                    id="issue-clearance-type"
                                    name="clearanceType"
                                    legend="Type"
                                    required
                                    columns={types.length > 1 ? 2 : 1}
                                    variant="compact"
                                    options={typeOptions}
                                    value={clearanceType}
                                    onChange={setClearanceType}
                                    error={error("clearanceType")}
                                    hint={suggestion && types.length > 1 ? suggestion.reason : undefined}
                                />
                                {types.length > 1 && (
                                    <p className="-mt-2 text-[13px] text-fg-muted">
                                        About the types:{" "}
                                        {types.map((value, index) => (
                                            <span key={value}>
                                                {index > 0 && ", "}
                                                <Term term={CLEARANCE_TYPE_TERMS[value]}>{CLEARANCE_TYPE_LABELS[value].toLowerCase()}</Term>
                                            </span>
                                        ))}
                                        .
                                    </p>
                                )}
                                {shownExisting && (
                                    <Callout
                                        tone="warning"
                                        icon={TriangleAlert}
                                        title="Already issued"
                                        role={existing ? "status" : "note"}
                                        action={
                                            <Link href={clearancesHref} className="text-[13px] font-medium text-primary-soft-fg hover:underline">
                                                View clearances
                                            </Link>
                                        }
                                    >
                                        A {CLEARANCE_TYPE_LABELS[shownExisting.clearanceType].toLowerCase()} clearance from this examination has been in place since {formatDate(shownExisting.issuedAt)}
                                        {shownExisting.validUntil ? `, valid until ${formatDate(shownExisting.validUntil)}` : ", with no end date"}. Revoke it first if it needs to change.
                                    </Callout>
                                )}

                                {changeDates ? (
                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                        <Field label="Starts" htmlFor={control("validFrom").id} error={error("validFrom")} optional hint="Leave empty to start when you issue it.">
                                            <Input {...control("validFrom", { hint: true })} type="date" min={examDay} />
                                        </Field>
                                        <Field
                                            label="Ends"
                                            htmlFor={control("validUntil").id}
                                            error={error("validUntil")}
                                            optional
                                            info={<TermHint term="validUntil" />}
                                            hint={examLastDay ? `Leave empty to end with the examination on ${formatDate(exam.validUntil ?? "")}.` : "Leave empty for no end date."}
                                        >
                                            <Input {...control("validUntil", { hint: true })} type="date" min={today} max={examLastDay} />
                                        </Field>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-start gap-2 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px] text-fg-muted sm:flex-row sm:items-center sm:justify-between">
                                        <p className="flex items-start gap-2">
                                            <CalendarRange aria-hidden className="mt-px size-4 shrink-0" />
                                            <span>
                                                Starts <span className="font-medium text-fg">when you issue it</span> and{" "}
                                                {exam.validUntil ? (
                                                    <>
                                                        ends <span className="font-medium text-fg">{formatDate(exam.validUntil)}</span>, with the examination&apos;s decision.
                                                    </>
                                                ) : (
                                                    <>
                                                        has <span className="font-medium text-fg">no end date</span>, like the examination&apos;s decision.
                                                    </>
                                                )}
                                            </span>
                                        </p>
                                        <Button variant="ghost" size="sm" onClick={() => setChangeDates(true)}>
                                            Change dates
                                        </Button>
                                    </div>
                                )}
                            </FormSection>

                            <FormSection title="Limits" info={<TermHint term="restrictions" />} description="Copied from the examination. You can narrow them, never widen them.">
                                <RestrictionFields key={exam.id} form={form} idPrefix="issue-clearance" defaults={exam.restrictions} bound={exam.restrictions} />
                                <Field label="Notes" htmlFor={control("notes").id} error={error("notes")} optional hint="Shown with the clearance to coaches and the fighter.">
                                    <Textarea {...control("notes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.clearanceNotes} />
                                </Field>
                            </FormSection>

                            <InlineNote icon={Info} className="mb-5">
                                Coaches plan {fighter.name}&apos;s sessions against it straight away. Clearances can&apos;t be edited: to change one, revoke it and issue a new one.
                            </InlineNote>
                        </>
                    )}

                    <FormFooter
                        message={form.message}
                        cancelHref={cancelHref}
                        pending={form.pending}
                        submitLabel={unconfirmed ? "Try again" : "Issue clearance"}
                        pendingLabel={unconfirmed ? "Checking the record…" : "Issuing…"}
                        disabled={!exam || Boolean(issued)}
                    />
                </Card>
            </form>
        </div>
    );
}
