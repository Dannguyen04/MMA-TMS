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
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createExaminationAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS, examinationTitle } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { ExaminationOutcome, ExaminationType, Vitals } from "@/lib/domain/types";
import { formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME, EXAMINATION_OUTCOME_DESCRIPTIONS, EXAMINATION_OUTCOME_META, ExaminationOutcomeBadge } from "./clinical-badges";
import { AssessmentsField, EMPTY_VITALS, ExaminationTypeField, FollowUpField, useAssessmentRows, VitalsFields } from "./examination-details-fields";
import { Scat6Fields } from "./scat6-fields";

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
}

const OUTCOME_OPTIONS: ChoiceOption<ExaminationOutcome>[] = (Object.keys(EXAMINATION_OUTCOME_LABELS) as ExaminationOutcome[]).map((value) => ({
    value,
    label: EXAMINATION_OUTCOME_LABELS[value],
    description: EXAMINATION_OUTCOME_DESCRIPTIONS[value],
    icon: EXAMINATION_OUTCOME_META[value].icon,
    tone: EXAMINATION_OUTCOME_META[value].tone,
}));
/** Records a medical examination: patient and visit, vitals with live reference ranges, assessments and outcome. */
export function ExaminationForm({ fighters, defaultFighterId, defaultType, defaultDateTime }: ExaminationFormProps) {
    const form = useActionForm(createExaminationAction, { id: "exam", hiddenFields: ["scat6"] });
    const id = (name: string) => `exam-${name}`;
    const { error } = form;

    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [type, setType] = useState<ExaminationType | "">(defaultType);
    const [date, setDate] = useState(defaultDateTime);
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const rows = useAssessmentRows(form, defaultType);
    const [outcome, setOutcome] = useState<ExaminationOutcome | "">("");
    const [summary, setSummary] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const examDay = date.slice(0, 10);

    const changeType = (next: ExaminationType | "") => {
        setType(next);
        rows.typeChanged(next);
    };

    const currentLevel = fighter && (fighter.clearanceState === "full" || fighter.clearanceState === "restricted" || fighter.clearanceState === "not_cleared") ? fighter.clearanceState : null;
    const outcomeMismatch = fighter && outcome ? currentLevel !== CLEARANCE_LEVEL_FOR_OUTCOME[outcome] : false;

    return (
        <form {...form.formProps}>
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
                        <ExaminationTypeField form={form} value={type} onChange={changeType} className="sm:col-span-2" />
                    </div>
                    <PatientContext fighter={fighter} />
                </FormSection>

                <FormSection
                    title="Vitals"
                    description="Reference ranges update as you type. Readings outside them are flagged for a recheck, not blocked."
                >
                    <VitalsFields form={form} value={vitals} onChange={setVitals} weightLimitKg={fighter?.weightLimitKg ?? null} required />
                </FormSection>

                <FormSection
                    title="Assessments"
                    description="One row per area examined. Describe every abnormal finding so the record is useful at follow-up."
                >
                    <AssessmentsField form={form} type={type} rows={rows} />
                </FormSection>

                <Scat6Fields form={form} nowInput={defaultDateTime} active={type === "baseline"} dateOfBirth={fighter?.dateOfBirth ?? null} />

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
                    <FollowUpField form={form} examDay={examDay} value={followUpDate} onChange={setFollowUpDate} hint="Appears on your dashboard as the date approaches." />
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
                            Last examination: <span className="font-medium text-fg">{examinationTitle(last)}</span>
                            <span>{formatDate(last.date)}</span>
                            <ExaminationOutcomeBadge outcome={last.outcome} size="sm" />
                        </p>
                        {last.vitals && (
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
                        )}
                    </>
                ) : (
                    <p className="text-fg-muted">No previous examinations — this will be their first. A baseline physical is recommended.</p>
                )}
            </div>
        </div>
    );
}
