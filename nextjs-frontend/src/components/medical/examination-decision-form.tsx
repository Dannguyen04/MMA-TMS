"use client";

import { CircleCheck, CircleSlash, FileText, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Term, TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Checkbox, Field, focusFirstInvalid, FormMessage, FormSection, Input, Textarea } from "@/components/ui/form";
import { FormStep, FormSteps, type FormStepDefinition } from "@/components/ui/form-steps";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordExaminationDecisionAction } from "@/lib/actions/medical-contract";
import { addMonthsToKey, RECONCILE_FIELD } from "@/lib/domain/medical-flow";
import {
    EXAMINATION_DECISIONS,
    EXAMINATION_DECISION_DESCRIPTIONS,
    EXAMINATION_DECISION_LABELS,
    EXAMINATION_SCOPES,
    EXAMINATION_SCOPE_DESCRIPTIONS,
    EXAMINATION_SCOPE_LABELS,
    MEDICAL_TEXT_LIMITS,
    type ExaminationDecision,
    type ExaminationScope,
    type MedicalReviewRequest,
} from "@/lib/domain/medical-contract";
import type { ExaminationType } from "@/lib/domain/types";
import { addDaysToKey, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { CurrentExamination } from "@/lib/services/medical";
import { AssessmentsField, EMPTY_VITALS, ExaminationTypeField, FollowUpField, useAssessmentRows, VitalsFields } from "./examination-details-fields";
import { assessmentRowsProblem } from "./examination-presets";
import { ExaminationReview, type ReviewRestrictions } from "./examination-review";
import { findingsSummary } from "./findings-summary";
import { QuickFill } from "./quick-fill";
import { RestrictionFields } from "./restriction-fields";
import { Scat6BalanceFields, Scat6HistoryFields, Scat6MemoryFields, Scat6RecordInput, useScat6Draft } from "./scat6-fields";
import type { Scat6Step } from "./scat6-draft";

export interface ExaminationDecisionFormProps {
    fighter: { id: string; name: string; dateOfBirth: string };
    currentExaminations: Record<ExaminationScope, CurrentExamination | null>;
    openReviewRequests: MedicalReviewRequest[];
    defaultScope: ExaminationScope;
    defaultType: ExaminationType | "";
    /** The fighter's class limit, for the weight check. */
    weightLimitKg: number | null;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    now: string;
    cancelHref: string;
}

const SCOPE_OPTIONS: ChoiceOption<ExaminationScope>[] = EXAMINATION_SCOPES.map((value) => ({
    value,
    label: EXAMINATION_SCOPE_LABELS[value],
    description: EXAMINATION_SCOPE_DESCRIPTIONS[value],
}));

const DECISION_META: Record<ExaminationDecision, Pick<ChoiceOption<ExaminationDecision>, "icon" | "tone">> = {
    ELIGIBLE: { icon: CircleCheck, tone: "success" },
    ELIGIBLE_WITH_RESTRICTIONS: { icon: ShieldAlert, tone: "warning" },
    NOT_ELIGIBLE: { icon: CircleSlash, tone: "danger" },
};

const DECISION_OPTIONS: ChoiceOption<ExaminationDecision>[] = EXAMINATION_DECISIONS.map((value) => ({
    value,
    label: EXAMINATION_DECISION_LABELS[value],
    description: EXAMINATION_DECISION_DESCRIPTIONS[value],
    ...DECISION_META[value],
}));

const SCAT6_STEPS: Record<string, Scat6Step> = { "scat6-history": "history", "scat6-memory": "memory", "scat6-balance": "balance" };

const VALIDITY_PICKS = [3, 6, 12];

/**
 * Records an examination as the medical service keeps it, in steps inside one form (one request when it's recorded):
 * the visit and vitals, the physical exam, for a baseline the SCAT6 in three steps, the decision, then a review of what
 * was entered. Only safe things are filled in for the doctor (scope, type, times, the fighter, the starting areas);
 * every finding is the doctor's, entered by hand or with a quick fill they click, which fills only what is still blank
 * and says what it filled. The answers live in this form only and are kept after any error.
 */
export function ExaminationDecisionForm({
    fighter,
    currentExaminations,
    openReviewRequests,
    defaultScope,
    defaultType,
    weightLimitKg,
    nowInput,
    now,
    cancelHref,
}: ExaminationDecisionFormProps) {
    const [type, setType] = useState<ExaminationType | "">(defaultType);
    const baseline = type === "baseline";
    const form = useActionForm(recordExaminationDecisionAction, {
        id: "exam-decision",
        hiddenFields: ["supersedesId", "scat6"],
        // A last check before sending: a SCAT6 answer left on a step the doctor jumped past is marked there instead.
        prepare: () => {
            const problems = baseline ? scat6.validateAll() : null;
            if (problems) return { status: "error", message: "Some SCAT6 answers still need attention. They're marked on their steps.", fieldErrors: problems };
        },
    });
    const { control, error } = form;
    const scat6 = useScat6Draft({ form, nowInput, dateOfBirth: fighter.dateOfBirth });
    const [scope, setScope] = useState<ExaminationScope>(defaultScope);
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const rows = useAssessmentRows(form, defaultType);
    const [checkRows, setCheckRows] = useState(false);
    const [examinedAt, setExaminedAt] = useState(nowInput);
    const [correcting, setCorrecting] = useState(false);
    const [decision, setDecision] = useState<ExaminationDecision | "">("");
    const [reason, setReason] = useState("");
    const [reasonNote, setReasonNote] = useState<string>();
    const [validUntil, setValidUntil] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [answered, setAnswered] = useState<string[]>(openReviewRequests.map((request) => request.id));
    const [restrictions, setRestrictions] = useState<ReviewRestrictions | null>(null);

    const current = currentExaminations[scope];
    const answersRequests = scope === "TRAINING" && openReviewRequests.length > 0;
    const administered = scat6.draft.status === "ADMINISTERED";
    const examDay = examinedAt.slice(0, 10);
    const unconfirmed = form.state.status === "error" && form.state.data?.unconfirmed === true;

    const steps = useMemo<FormStepDefinition[]>(
        () => [
            { id: "visit", label: "Vitals", description: "Visit and readings" },
            { id: "physical", label: "Physical exam", description: "Areas assessed" },
            ...(baseline
                ? administered
                    ? [
                          { id: "scat6-history", label: "SCAT6: history", description: "History and symptoms" },
                          { id: "scat6-memory", label: "SCAT6: memory", description: "Memory and concentration" },
                          { id: "scat6-balance", label: "SCAT6: balance", description: "Balance and recall" },
                      ]
                    : [{ id: "scat6-history", label: "SCAT6", description: "Not administered" }]
                : []),
            { id: "decision", label: "Decision", description: "Decision and follow-up" },
            { id: "review", label: "Review", description: "Check and record" },
        ],
        [baseline, administered],
    );

    /** The restriction lists as the form holds them now, read from the form itself (the pickers keep their own state). */
    const readRestrictions = (): ReviewRestrictions | null => {
        const element = form.formProps.ref.current;
        if (!element || decision !== "ELIGIBLE_WITH_RESTRICTIONS") return null;
        const data = new FormData(element);
        const list = (name: string) => data.getAll(name).map(String);
        return {
            sessions: data.get("limitSessions") ? list("allowedSessionTypes") : null,
            techniques: data.get("limitTechniques") ? list("allowedTechniqueTypes") : null,
            joints: list("excludedJoints"),
            notes: String(data.get("restrictionNotes") ?? ""),
        };
    };

    const validateStep = (stepId: string, panel: HTMLElement): string | null => {
        const message = stepProblem(stepId);
        // The markers for the problem render with this update; focus the first one once they're there.
        if (message) window.requestAnimationFrame(() => focusFirstInvalid(panel));
        return message;
    };

    const stepProblem = (stepId: string): string | null => {
        if (stepId === "visit") {
            const entered = Object.values(vitals).filter((value) => value.trim() !== "").length;
            return !baseline && entered > 0 && entered < Object.keys(vitals).length ? "Enter every vital reading, or clear them all." : null;
        }
        if (stepId === "physical") {
            setCheckRows(true);
            return assessmentRowsProblem(rows.rows, { baseline });
        }
        if (stepId in SCAT6_STEPS) return scat6.validate(SCAT6_STEPS[stepId]);
        if (stepId === "decision") {
            if (reason.trim().length < 10) return "Explain your decision in a sentence or two.";
            const lists = readRestrictions();
            if (lists) {
                if (lists.sessions?.length === 0) return "Choose at least one session type the fighter may do, or turn that limit off.";
                if (lists.techniques?.length === 0) return "Choose at least one technique the fighter may use, or turn that limit off.";
                if (lists.sessions === null && lists.techniques === null && lists.joints.length === 0 && !lists.notes.trim()) return "Set at least one limit or write the restrictions in the notes.";
            }
        }
        return null;
    };

    const insertSummary = () => {
        const summary = findingsSummary({
            type,
            vitals,
            assessments: rows.rows,
            scat6: baseline ? { status: scat6.draft.status, reason: scat6.draft.notAdministeredReason } : null,
        });
        if (!summary) {
            setReasonNote("Nothing to summarise yet: enter the vitals and areas first.");
            return;
        }
        if (reason.includes(summary)) return;
        setReason(reason.trim() ? `${reason.trimEnd()}\n\n${summary}` : summary);
        setReasonNote("Inserted from what you entered. Add your reasoning and edit it before you record.");
        form.markEdited("reason");
    };

    return (
        <form {...form.formProps}>
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <input type="hidden" name="fighterId" value={fighter.id} />
                <input type="hidden" name="knownCurrentId" value={current?.id ?? ""} />
                {unconfirmed && <input type="hidden" name={RECONCILE_FIELD} value="1" />}
                {baseline && <Scat6RecordInput scat6={scat6} />}

                <FormSteps
                    steps={steps}
                    state={form.state}
                    validateStep={validateStep}
                    onStepChange={(stepId) => {
                        if (stepId === "review") setRestrictions(readRestrictions());
                    }}
                    cancel={
                        <ButtonLink href={cancelHref} variant="ghost" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            Cancel
                        </ButtonLink>
                    }
                    message={<FormMessage {...form.message} />}
                    submit={
                        <SubmitButton pending={form.pending} pendingLabel={unconfirmed ? "Checking the record…" : "Recording…"} size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            {unconfirmed ? "Try again" : "Record examination"}
                        </SubmitButton>
                    }
                >
                    <FormStep id="visit" title="Visit and vitals" description={`What this examination decides for ${fighter.name}, and the readings.`}>
                        <FormSection title="Scope and visit" info={<TermHint term="examinationScope" />} description="What this examination decides, what kind of visit it was and when.">
                            <ChoiceGroup
                                id="exam-decision-scope"
                                name="scope"
                                legend="Scope"
                                legendVisuallyHidden
                                required
                                columns={2}
                                variant="compact"
                                options={SCOPE_OPTIONS}
                                value={scope}
                                onChange={(next) => {
                                    setScope(next);
                                    setCorrecting(false);
                                }}
                                error={error("scope")}
                            />
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <ExaminationTypeField
                                    form={form}
                                    value={type}
                                    onChange={(next) => {
                                        setType(next);
                                        rows.typeChanged(next);
                                    }}
                                />
                                <Field label="Examined" htmlFor={control("examinedAt").id} error={error("examinedAt")} required hint="Academy time (Ho Chi Minh City)">
                                    <Input
                                        {...control("examinedAt", { hint: true, required: true })}
                                        type="datetime-local"
                                        value={examinedAt}
                                        max={nowInput}
                                        onChange={(event) => setExaminedAt(event.target.value)}
                                        className="sm:w-64"
                                    />
                                </Field>
                            </div>
                            {baseline && scope === "COMPETITION" && (
                                <Callout tone="warning" icon={TriangleAlert} title="A competition baseline doesn't count for training">
                                    Record the baseline under Training so {fighter.name} can start training.
                                </Callout>
                            )}
                            {current && (
                                <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px]">
                                    <p className="text-fg-muted">
                                        Current {EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} examination:{" "}
                                        <span className="font-medium text-fg">{EXAMINATION_DECISION_LABELS[current.decision]}</span> on{" "}
                                        <time dateTime={current.examinedAt}>{formatDateTime(current.examinedAt)}</time>
                                        {current.validUntil && <>, valid until {formatDate(current.validUntil)}</>}
                                    </p>
                                    <input type="hidden" name="supersedesId" value={current.id} />
                                    <Checkbox
                                        id="exam-decision-correction"
                                        name="correction"
                                        checked={correcting}
                                        onChange={(event) => setCorrecting(event.target.checked)}
                                        label="This corrects that examination"
                                        description="Only for a mistake in the record. A new visit is a new examination."
                                        info={<TermHint term="examinationCorrection" />}
                                    />
                                    {error("supersedesId") && <p className="font-medium text-danger-fg">{error("supersedesId")}</p>}
                                </div>
                            )}
                        </FormSection>
                        <FormSection title="Vitals" description={baseline ? "Required for a baseline. Readings outside athlete ranges are flagged, not blocked." : "Optional. Enter every reading, or none."}>
                            <VitalsFields form={form} value={vitals} onChange={setVitals} weightLimitKg={weightLimitKg} required={baseline} />
                        </FormSection>
                    </FormStep>

                    <FormStep id="physical" title="Physical exam" description={baseline ? "One row per area examined; a baseline needs at least one. Mark every result." : "One row per area examined, if any."}>
                        <FormSection title="Assessments" info={<TermHint term="assessedArea" />}>
                            <AssessmentsField form={form} type={type} rows={rows} checkMissing={checkRows} />
                        </FormSection>
                    </FormStep>

                    {baseline && (
                        <FormStep id="scat6-history" title={administered ? "SCAT6 — history and symptoms" : "SCAT6"}>
                            <Scat6HistoryFields scat6={scat6} />
                        </FormStep>
                    )}
                    {baseline && administered && (
                        <FormStep id="scat6-memory" title="SCAT6 — memory and concentration" description={<Term term="cognitiveScreening">Cognitive screening</Term>}>
                            <Scat6MemoryFields scat6={scat6} />
                        </FormStep>
                    )}
                    {baseline && administered && (
                        <FormStep id="scat6-balance" title="SCAT6 — balance and recall" description={<Term term="coordinationBalance">Coordination and balance</Term>}>
                            <Scat6BalanceFields scat6={scat6} />
                        </FormStep>
                    )}

                    <FormStep id="decision" title="Decision" description="Your clinical decision, the reasoning behind it and what happens next.">
                        <FormSection title="Decision" info={<TermHint term="eligibleWithRestrictions" />}>
                            <ChoiceGroup
                                id="exam-decision-decision"
                                name="decision"
                                legend="Decision"
                                required
                                options={DECISION_OPTIONS}
                                value={decision}
                                onChange={setDecision}
                                error={error("decision")}
                                hint="An eligible decision still needs a Medical Clearance, issued in the next step."
                            />
                            {decision === "NOT_ELIGIBLE" && (
                                <Callout tone="danger" icon={TriangleAlert} title={`Active ${EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} clearances are revoked`}>
                                    {fighter.name} stops {scope === "TRAINING" ? "training" : "competing"} as soon as you record this. A later examination is needed to change it.
                                </Callout>
                            )}
                            <div className="flex flex-col gap-2">
                                <Field
                                    label="Findings and reasoning"
                                    htmlFor={control("reason").id}
                                    error={error("reason")}
                                    required
                                    info={<TermHint term="findingsAndReasoning" />}
                                    hint="The fighter can read this on their Health page. Coaches can't."
                                >
                                    <Textarea
                                        {...control("reason", { hint: true, required: true })}
                                        rows={5}
                                        maxLength={MEDICAL_TEXT_LIMITS.examinationReason}
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                    />
                                </Field>
                                <QuickFill label="Insert findings summary" icon={FileText} available note={reasonNote} onClick={insertSummary} />
                            </div>
                            {decision !== "NOT_ELIGIBLE" && (
                                <div className="flex flex-col gap-2">
                                    <Field
                                        label="Decision valid until"
                                        htmlFor={control("validUntil").id}
                                        error={error("validUntil")}
                                        optional
                                        info={<TermHint term="validUntil" />}
                                        hint="Leave empty for no end date. A clearance from this examination can't last longer."
                                    >
                                        <Input
                                            {...control("validUntil", { hint: true })}
                                            type="date"
                                            value={validUntil}
                                            min={examDay ? addDaysToKey(examDay, 1) : undefined}
                                            onChange={(event) => setValidUntil(event.target.value)}
                                            className="sm:w-56"
                                        />
                                    </Field>
                                    {examDay && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <SuggestionChips
                                                label="Valid for"
                                                suggestions={VALIDITY_PICKS.map((months) => ({ label: `${months} months`, value: addMonthsToKey(examDay, months) }))}
                                                onPick={(value) => {
                                                    setValidUntil(value);
                                                    form.markEdited("validUntil");
                                                }}
                                            />
                                            {validUntil && (
                                                <Button variant="ghost" size="sm" onClick={() => setValidUntil("")}>
                                                    No end date
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </FormSection>

                        {decision === "ELIGIBLE_WITH_RESTRICTIONS" && (
                            <FormSection title="Restrictions" info={<TermHint term="restrictions" />} description="What the fighter may do. A clearance issued from this examination can only narrow it.">
                                <RestrictionFields form={form} idPrefix="exam-decision" />
                                <Field label="Restriction notes" htmlFor={control("restrictionNotes").id} error={error("restrictionNotes")} optional hint="Anything the lists can't say, e.g. intensity or duration.">
                                    <Textarea {...control("restrictionNotes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.restrictionNotes} />
                                </Field>
                                {error("restrictions") && (
                                    <p data-invalid="true" className="text-[13px] font-medium text-danger-fg">
                                        {error("restrictions")}
                                    </p>
                                )}
                            </FormSection>
                        )}

                        <FormSection title="Recommendations and follow-up" description="Next steps for the fighter and staff, and when to examine again.">
                            <Field label="Recommendations" htmlFor={control("recommendations").id} error={error("recommendations")} optional hint="Visible to the fighter with the examination.">
                                <Textarea
                                    {...control("recommendations", { hint: true })}
                                    rows={3}
                                    maxLength={MEDICAL_TEXT_LIMITS.clinicalText}
                                    value={recommendations}
                                    onChange={(event) => setRecommendations(event.target.value)}
                                />
                            </Field>
                            <FollowUpField form={form} examDay={examDay} value={followUpDate} onChange={setFollowUpDate} hint="Shows on your dashboard as the date approaches." />
                        </FormSection>

                        {answersRequests && (
                            <FormSection
                                title="Review requests"
                                info={<TermHint term="reviewRequest" />}
                                description="Ticked requests are answered by this examination and stop pausing training. Untick any this visit doesn't answer."
                            >
                                <fieldset aria-invalid={error("reviewRequestIds") ? true : undefined} data-invalid={error("reviewRequestIds") ? "true" : undefined} className="flex flex-col gap-2.5">
                                    <legend className="sr-only">Review requests answered</legend>
                                    {openReviewRequests.map((request) => (
                                        <Checkbox
                                            key={request.id}
                                            id={`exam-decision-request-${request.id}`}
                                            name="reviewRequestIds"
                                            value={request.id}
                                            checked={answered.includes(request.id)}
                                            onChange={(event) => {
                                                setAnswered(event.target.checked ? [...answered, request.id] : answered.filter((id) => id !== request.id));
                                                form.markEdited("reviewRequestIds");
                                            }}
                                            label={`“${request.reason}”`}
                                            description={`Requested ${formatRelative(request.requestedAt, now).toLowerCase()}`}
                                        />
                                    ))}
                                    {error("reviewRequestIds") && <p className="text-[13px] font-medium text-danger-fg">{error("reviewRequestIds")}</p>}
                                </fieldset>
                            </FormSection>
                        )}
                    </FormStep>

                    <FormStep id="review" title="Review" description="Check what you entered. The medical service calculates the SCAT6 scores once it's recorded.">
                        <div className="flex flex-col gap-5">
                            <ExaminationReview
                                scope={scope}
                                type={type}
                                examinedAt={examinedAt}
                                correcting={correcting}
                                vitals={vitals}
                                rows={rows.rows}
                                scat6={baseline ? scat6.draft : null}
                                decision={decision}
                                reason={reason}
                                validUntil={validUntil}
                                recommendations={recommendations}
                                followUpDate={followUpDate}
                                restrictions={decision === "ELIGIBLE_WITH_RESTRICTIONS" ? restrictions : null}
                                reviewRequests={{ answered: answersRequests ? answered.length : 0, open: answersRequests ? openReviewRequests.length : 0 }}
                            />
                            <InlineNote icon={Info}>
                                Examinations can&apos;t be edited or deleted; a mistake is fixed with a correction.{" "}
                                {decision === "NOT_ELIGIBLE"
                                    ? `${fighter.name} stops ${scope === "TRAINING" ? "training" : "competing"} once you record it.`
                                    : `Next, step 2 of 2: issue the Medical Clearance so ${fighter.name} can ${scope === "TRAINING" ? "train" : "compete"}.`}
                            </InlineNote>
                        </div>
                    </FormStep>
                </FormSteps>
            </Card>
        </form>
    );
}
