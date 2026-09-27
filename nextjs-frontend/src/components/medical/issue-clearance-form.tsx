"use client";

import { Info, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Callout } from "@/components/training/callout";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Textarea } from "@/components/ui/form";
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
import type { MedicalClearance } from "@/lib/domain/types";
import { dayKey, formatDate } from "@/lib/format";
import type { CurrentExamination } from "@/lib/services/medical";
import { RestrictionFields } from "./restriction-fields";

export interface IssueClearanceFormProps {
    fighter: { id: string; name: string };
    /** The fighter's current positive examinations, one per scope at most. */
    examinations: CurrentExamination[];
    /** Clearances in force, to warn before issuing a duplicate. */
    activeClearances: MedicalClearance[];
    defaultExaminationId: string;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    cancelHref: string;
}

const CLEARANCE_TYPE_DESCRIPTIONS: Record<ClearanceType, string> = {
    TRAINING: "Routine training clearance.",
    RETURN_FROM_INJURY: "Back to training after an injury, usually with limits.",
    COMPETITION: "Clears the fighter to compete in a bout.",
};

/**
 * Issues a clearance from the fighter's current positive examination. Dates and limits start from the examination
 * and can only be narrowed: the form offers no way to allow more than the examination did.
 */
export function IssueClearanceForm({ fighter, examinations, activeClearances, defaultExaminationId, today, cancelHref }: IssueClearanceFormProps) {
    const form = useActionForm(issueClearanceAction, { id: "issue-clearance" });
    const { control, error } = form;
    const [examinationId, setExaminationId] = useState(examinations.find((exam) => exam.id === defaultExaminationId)?.id ?? examinations[0]?.id ?? "");
    const exam = examinations.find((candidate) => candidate.id === examinationId) ?? null;
    const types = exam ? CLEARANCE_TYPES_BY_SCOPE[exam.scope] : [];
    const [clearanceType, setClearanceType] = useState<ClearanceType | "">(types.length === 1 ? types[0] : "");
    const duplicate = exam && clearanceType ? activeClearances.find((clearance) => clearance.examinationId === exam.id && clearance.clearanceType === clearanceType) : undefined;
    const examDay = exam ? dayKey(exam.examinedAt) : today;
    const examLastDay = exam?.validUntil ? dayKey(exam.validUntil) : undefined;

    const examOptions: ChoiceOption<string>[] = examinations.map((candidate) => ({
        value: candidate.id,
        label: `${EXAMINATION_SCOPE_LABELS[candidate.scope]} — ${EXAMINATION_DECISION_LABELS[candidate.decision]}`,
        description: `Examined ${formatDate(candidate.examinedAt)}${candidate.validUntil ? ` · valid until ${formatDate(candidate.validUntil)}` : ""}`,
    }));
    const typeOptions: ChoiceOption<ClearanceType>[] = types.map((value) => ({ value, label: CLEARANCE_TYPE_LABELS[value], description: CLEARANCE_TYPE_DESCRIPTIONS[value] }));

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <input type="hidden" name="fighterId" value={fighter.id} />

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
                            const nextExam = examinations.find((candidate) => candidate.id === next);
                            const nextTypes = nextExam ? CLEARANCE_TYPES_BY_SCOPE[nextExam.scope] : [];
                            setClearanceType(nextTypes.length === 1 ? nextTypes[0] : "");
                        }}
                        error={error("examinationId")}
                    />
                    {exam && <p className="rounded-lg bg-surface-muted px-3.5 py-3 text-[13px] text-pretty text-fg-muted">“{exam.reason}”</p>}
                </FormSection>

                {exam && (
                    <>
                        <FormSection title="Clearance" description="What it clears the fighter for, and when.">
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
                            />
                            {duplicate && (
                                <Callout tone="warning" icon={TriangleAlert} title="Already issued">
                                    A {CLEARANCE_TYPE_LABELS[duplicate.clearanceType ?? "TRAINING"].toLowerCase()} clearance from this examination is still active. Revoke it
                                    first if it needs to change.
                                </Callout>
                            )}
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <Field label="Starts" htmlFor={control("validFrom").id} error={error("validFrom")} optional hint="Leave empty to start now.">
                                    <Input {...control("validFrom", { hint: true })} type="date" min={examDay} />
                                </Field>
                                <Field
                                    label="Ends"
                                    htmlFor={control("validUntil").id}
                                    error={error("validUntil")}
                                    optional
                                    hint={examLastDay ? `Leave empty to end with the examination on ${formatDate(exam.validUntil ?? "")}.` : "Leave empty for no end date."}
                                >
                                    <Input {...control("validUntil", { hint: true })} type="date" min={today} max={examLastDay} />
                                </Field>
                            </div>
                        </FormSection>

                        <FormSection title="Limits" description="Starts from the examination's limits. You can narrow them, never widen them.">
                            <RestrictionFields key={exam.id} form={form} idPrefix="issue-clearance" defaults={exam.restrictions} bound={exam.restrictions} />
                            <Field label="Notes" htmlFor={control("notes").id} error={error("notes")} optional hint="Shown with the clearance to coaches and the fighter.">
                                <Textarea {...control("notes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.clearanceNotes} />
                            </Field>
                        </FormSection>
                    </>
                )}

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <FormMessage {...form.message} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <ButtonLink href={cancelHref} variant="secondary" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            Cancel
                        </ButtonLink>
                        <Button type="submit" size="lg" loading={form.pending} disabled={!exam} className="sm:h-9 sm:px-3.5 sm:text-sm">
                            {form.pending ? "Issuing…" : "Issue clearance"}
                        </Button>
                    </div>
                </div>
            </Card>

            <aside aria-label="What happens next" className="min-w-0">
                <Card>
                    <CardHeader title="When you issue it" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li>Coaches plan {fighter.name}&apos;s sessions against it straight away.</li>
                            <li>Clearances can&apos;t be edited. To change one, revoke it and issue a new one.</li>
                            <li>A later examination that finds the fighter not eligible revokes it automatically.</li>
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
