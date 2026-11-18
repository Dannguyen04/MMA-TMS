"use client";

import { Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Term, TermHint } from "@/components/domain/term-hint";
import { useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { issueClearanceAction } from "@/lib/actions/medical-contract";
import {
    CLEARANCE_TYPES_BY_SCOPE,
    MEDICAL_TEXT_LIMITS,
    type ClearanceType,
} from "@/lib/domain/medical-contract";
import type { RestrictionLists } from "@/lib/domain/medical-bodies";
import { clearanceFromExamination, RECONCILE_FIELD, suggestClearanceType, type ClearanceTypeSuggestion } from "@/lib/domain/medical-flow";
import type { GlossaryTerm } from "@/lib/domain/glossary";
import type { MedicalClearance } from "@/lib/domain/types";
import { addDaysToKey, dayKey, formatDate } from "@/lib/format";
import { plural, type MessageKey } from "@/lib/i18n/translate-client";
import type { CurrentExamination } from "@/lib/services/medical";
import { ExaminationReadBack } from "./examination-read-back";
import type { ProgressStep } from "./exam-progress";
import { ExamProgressRail } from "./exam-progress-rail";
import { DemoFillBar, FormPart } from "./form-parts";
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
    /** Development only: a one-click fill for presenting the flow. Nothing is issued until "Cấp giấy phép". */
    demoFill?: boolean;
}

const CLEARANCE_TYPE_DESCRIPTIONS: Record<ClearanceType, MessageKey> = {
    TRAINING: "doctorMedical.issue.typeDescription.TRAINING",
    RETURN_FROM_INJURY: "doctorMedical.issue.typeDescription.RETURN_FROM_INJURY",
    COMPETITION: "doctorMedical.issue.typeDescription.COMPETITION",
};

/** Quick picks for the end date, in days from today; only those inside the examination's validity are offered. */
const VALIDITY_PICKS = [7, 30, 90] as const;

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
export function IssueClearanceForm({ fighter, examinations, activeClearances, activeInjuries, defaultExaminationId, weightLimitKg, today, cancelHref, clearancesHref, demoFill = false }: IssueClearanceFormProps) {
    const t = useT();
    const form = useActionForm(issueClearanceAction, { id: "issue-clearance" });
    const { control, error } = form;
    const suggestionFor = (exam: CurrentExamination | null) => (exam ? suggestClearanceType({ scope: exam.scope, examinationType: exam.details?.type ?? null, activeInjuries }) : null);
    const [examinationId, setExaminationId] = useState(examinations.find((exam) => exam.id === defaultExaminationId)?.id ?? examinations[0]?.id ?? "");
    const exam = examinations.find((candidate) => candidate.id === examinationId) ?? null;
    const suggestion = suggestionFor(exam);
    const [clearanceType, setClearanceType] = useState<ClearanceType | "">(() => startingType(exam, suggestion));
    const [validFrom, setValidFrom] = useState("");
    const [validUntil, setValidUntil] = useState("");
    // The limit pickers keep their own state; a new key re-seeds them (demo fill, "Xóa hết", another examination).
    const [limits, setLimits] = useState<{ key: number; lists: RestrictionLists | null }>({ key: 0, lists: null });
    const [notes, setNotes] = useState("");
    const types = exam ? CLEARANCE_TYPES_BY_SCOPE[exam.scope] : [];
    const issued = exam && clearanceType ? clearanceFromExamination(activeClearances, exam.id, clearanceType) : null;
    const existing = form.state.status === "error" ? form.state.data?.existingClearance : undefined;
    const unconfirmed = form.state.status === "error" && form.state.data?.unconfirmed === true;
    const shownExisting = existing ?? (issued && clearanceType ? { clearanceType: issued.clearanceType ?? clearanceType, issuedAt: issued.issuedAt, validUntil: issued.validUntil } : null);
    const examDay = exam ? dayKey(exam.examinedAt) : today;
    const examLastDay = exam?.validUntil ? dayKey(exam.validUntil) : undefined;

    const examOptions: ChoiceOption<string>[] = examinations.map((candidate) => ({
        value: candidate.id,
        label: `${t(`doctorMedical.scope.${candidate.scope}`)} — ${t(`doctorMedical.decision.${candidate.decision}`)}`,
        description: candidate.validUntil
            ? t("doctorMedical.issue.examinedValid", { date: formatDate(candidate.examinedAt), until: formatDate(candidate.validUntil) })
            : t("doctorMedical.issue.examined", { date: formatDate(candidate.examinedAt) }),
    }));
    const typeOptions: ChoiceOption<ClearanceType>[] = types.map((value) => ({
        value,
        label: t(`doctorMedical.clearanceType.${value}`),
        description: t(CLEARANCE_TYPE_DESCRIPTIONS[value]),
        extra:
            suggestion?.type === value && types.length > 1 ? (
                <Badge tone="info" size="sm" className="mt-1.5">
                    {t("doctorMedical.issue.suggested")}
                </Badge>
            ) : undefined,
    }));

    const steps: ProgressStep[] = [
        {
            key: "basis",
            label: t("doctorMedical.grant.basis"),
            pct: exam ? 1 : 0,
            state: exam ? "done" : "todo",
            text: exam ? t("doctorMedical.issue.examined", { date: formatDate(exam.examinedAt) }) : t("doctorMedical.issue.noExam"),
        },
        {
            key: "clearance",
            label: t("doctorMedical.steps.clearance"),
            pct: clearanceType && !shownExisting ? 1 : clearanceType ? 0.5 : 0,
            state: shownExisting ? "need" : clearanceType ? "done" : "todo",
            text: shownExisting ? t("doctorMedical.issue.issuedBefore") : clearanceType ? t(`doctorMedical.clearanceType.${clearanceType}`) : t("doctorMedical.issue.chooseType"),
        },
        // Limits are copied from the examination, so this part is complete unless the doctor narrows them.
        { key: "limits", label: t("doctorMedical.issue.limits"), pct: exam ? 1 : 0, state: exam ? "done" : "todo", text: exam ? t("doctorMedical.issue.perExam") : "—" },
    ];

    const validityPicks = VALIDITY_PICKS.map((days) => ({ days, date: addDaysToKey(today, days) })).filter((pick) => !examLastDay || pick.date <= examLastDay);

    function resetDatesAndLimits() {
        setValidFrom("");
        setValidUntil("");
        setLimits((current) => ({ key: current.key + 1, lists: null }));
    }

    /**
     * Development only: picks the suggested type, ends the clearance in 30 days when the examination allows it, narrows
     * the session types to non-contact work (inside the examination's limits), protects the right knee and writes a note.
     */
    const fillSample = () => {
        const nextExam = exam ?? examinations[0] ?? null;
        if (!nextExam) return;
        const allowed = CLEARANCE_TYPES_BY_SCOPE[nextExam.scope];
        const suggested = suggestionFor(nextExam)?.type;
        const bound: RestrictionLists = nextExam.restrictions ?? { allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: null };
        const nonContact = ["SHADOW_BOXING", "PAD_WORK", "HEAVY_BAG", "STRENGTH_CONDITIONING", "RECOVERY"] as const;
        const sessions = bound.allowedSessionTypes ? bound.allowedSessionTypes.filter((value) => (nonContact as readonly string[]).includes(value)) : [...nonContact];
        const lastDay = nextExam.validUntil ? dayKey(nextExam.validUntil) : undefined;
        const until = addDaysToKey(today, 30);
        setExaminationId(nextExam.id);
        // Prefer the suggestion, but skip a type already issued from this examination so the sample can be issued.
        const open = allowed.filter((value) => !clearanceFromExamination(activeClearances, nextExam.id, value));
        const candidates = open.length > 0 ? open : allowed;
        setClearanceType(suggested && candidates.includes(suggested) ? suggested : candidates[0]);
        setValidFrom("");
        setValidUntil(!lastDay || until <= lastDay ? until : "");
        setLimits((current) => ({
            key: current.key + 1,
            lists: {
                allowedSessionTypes: sessions.length > 0 ? sessions : bound.allowedSessionTypes,
                allowedTechniqueTypes: bound.allowedTechniqueTypes,
                excludedJoints: [...new Set([...(bound.excludedJoints ?? []), "RIGHT_KNEE" as const])],
            },
        }));
        setNotes(t("doctorMedical.issue.sampleNotes"));
        ["examinationId", "clearanceType", "validUntil", "allowedSessionTypes", "excludedJoints", "notes"].forEach((name) => form.markEdited(name));
    };
    const clearAll = () => {
        setClearanceType("");
        resetDatesAndLimits();
        setNotes("");
    };

    return (
        <form {...form.formProps} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <input type="hidden" name="fighterId" value={fighter.id} />
            {unconfirmed && <input type="hidden" name={RECONCILE_FIELD} value="1" />}
            {demoFill && examinations.length > 0 && (
                <DemoFillBar
                    className="xl:col-span-2"
                    title={t("doctorMedical.decision.demoTitle")}
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="iclr-" id="basis" title={t("doctorMedical.grant.basis")}>
                    {examinations.length > 1 ? (
                        <ChoiceGroup
                            id="issue-clearance-exam"
                            name="examinationId"
                            legend={t("doctorMedical.steps.examination")}
                            legendVisuallyHidden
                            required
                            columns={2}
                            variant="compact"
                            options={examOptions}
                            value={examinationId}
                            onChange={(next) => {
                                setExaminationId(next);
                                const nextExam = examinations.find((candidate) => candidate.id === next) ?? null;
                                setClearanceType(startingType(nextExam, suggestionFor(nextExam)));
                                resetDatesAndLimits();
                            }}
                            error={error("examinationId")}
                        />
                    ) : (
                        exam && <input type="hidden" name="examinationId" value={exam.id} />
                    )}
                    {exam && <ExaminationReadBack exam={exam} weightLimitKg={weightLimitKg} />}
                </FormPart>

                {exam && (
                    <FormPart prefix="iclr-" id="clearance" title={t("doctorMedical.steps.clearance")}>
                        <ChoiceGroup
                            id="issue-clearance-type"
                            name="clearanceType"
                            legend={t("doctorMedical.issue.type")}
                            required
                            columns={types.length > 2 ? 3 : types.length > 1 ? 2 : 1}
                            variant="compact"
                            options={typeOptions}
                            value={clearanceType}
                            onChange={setClearanceType}
                            error={error("clearanceType")}
                            hint={suggestion && types.length > 1 ? suggestion.reason : undefined}
                        />
                        {types.length > 1 && (
                            <p className="-mt-2 text-[13px] text-fg-muted">
                                {t("doctorMedical.issue.aboutTypes")}{" "}
                                {types.map((value, index) => (
                                    <span key={value}>
                                        {index > 0 && ", "}
                                        <Term term={CLEARANCE_TYPE_TERMS[value]}>{t(`doctorMedical.clearanceType.${value}`).toLowerCase()}</Term>
                                    </span>
                                ))}
                                .
                            </p>
                        )}
                        {shownExisting && (
                            <Callout
                                tone="warning"
                                icon={TriangleAlert}
                                title={t("doctorMedical.issue.issued")}
                                role={existing ? "status" : "note"}
                                action={
                                    <Link href={clearancesHref} className="text-[13px] font-medium text-primary-soft-fg hover:underline">
                                        {t("doctorMedical.issue.viewClearance")}
                                    </Link>
                                }
                            >
                                {t("doctorMedical.issue.existing", {
                                    type: t(`doctorMedical.clearanceType.${shownExisting.clearanceType}`).toLowerCase(),
                                    date: formatDate(shownExisting.issuedAt),
                                    end: shownExisting.validUntil
                                        ? t("doctorMedical.issue.existingUntil", { date: formatDate(shownExisting.validUntil) })
                                        : t("doctorMedical.issue.existingNoEnd"),
                                })}
                            </Callout>
                        )}

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <Field label={t("doctorMedical.issue.start")} htmlFor={control("validFrom").id} error={error("validFrom")} optional hint={t("doctorMedical.issue.startHint")}>
                                <Input {...control("validFrom", { hint: true })} type="date" min={examDay} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
                            </Field>
                            <Field
                                label={t("doctorMedical.issue.end")}
                                htmlFor={control("validUntil").id}
                                error={error("validUntil")}
                                optional
                                info={<TermHint term="validUntil" />}
                                hint={examLastDay ? t("doctorMedical.issue.endWithExam", { date: formatDate(exam.validUntil ?? "") }) : t("doctorMedical.issue.endNone")}
                            >
                                <Input {...control("validUntil", { hint: true })} type="date" min={today} max={examLastDay} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                            </Field>
                        </div>
                        <div role="group" aria-label={t("doctorMedical.issue.quickEndLabel")} className="-mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[13px] text-fg-subtle">{t("doctorMedical.issue.quickPick")}</span>
                            {validityPicks.map((pick) => (
                                <Button
                                    key={pick.days}
                                    variant={validUntil === pick.date ? "primary" : "secondary"}
                                    size="sm"
                                    aria-pressed={validUntil === pick.date}
                                    onClick={() => {
                                        setValidUntil(pick.date);
                                        form.markEdited("validUntil");
                                    }}
                                >
                                    {plural(t, "doctorMedical.days", pick.days)}
                                </Button>
                            ))}
                            <Button
                                variant={validUntil === "" ? "primary" : "secondary"}
                                size="sm"
                                aria-pressed={validUntil === ""}
                                onClick={() => {
                                    setValidUntil("");
                                    form.markEdited("validUntil");
                                }}
                            >
                                {examLastDay ? t("doctorMedical.issue.perExam") : t("doctorMedical.decision.noEnd")}
                            </Button>
                        </div>
                    </FormPart>
                )}

                {exam && (
                    <FormPart prefix="iclr-" id="limits" title={t("doctorMedical.issue.limits")} description={t("doctorMedical.issue.limitsDescription")}>
                        <RestrictionFields key={`${exam.id}-${limits.key}`} form={form} idPrefix="issue-clearance" defaults={limits.lists ?? exam.restrictions} bound={exam.restrictions} />
                        <Field label={t("doctorMedical.issue.notes")} htmlFor={control("notes").id} error={error("notes")} optional hint={t("doctorMedical.issue.notesHint")}>
                            <Textarea {...control("notes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.clearanceNotes} value={notes} onChange={(event) => setNotes(event.target.value)} />
                        </Field>
                    </FormPart>
                )}
            </Card>

            <div className="xl:sticky xl:top-32">
                <ExamProgressRail
                    steps={steps}
                    title={t("doctorMedical.grant.progressTitle")}
                    label={t("doctorMedical.grant.progressLabel")}
                    anchorPrefix="iclr-"
                    actions={
                        <>
                            <FormMessage {...form.message} />
                            <SubmitButton pending={form.pending} pendingLabel={unconfirmed ? t("doctorMedical.checkingRecord") : t("doctorMedical.issue.issuing")} disabled={!exam || Boolean(issued)} className="w-full">
                                {unconfirmed ? t("doctorMedical.retry") : t("doctorMedical.grant.submit")}
                            </SubmitButton>
                            <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                                {t("doctorMedical.cancel")}
                            </Link>
                        </>
                    }
                    footer={
                        <InlineNote icon={Info}>
                            {t("doctorMedical.issue.footer", { name: fighter.name })}
                        </InlineNote>
                    }
                />
            </div>
        </form>
    );
}
