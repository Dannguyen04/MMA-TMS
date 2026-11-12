"use client";

import { CircleCheck, CircleSlash, FileText, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { TermHint } from "@/components/domain/term-hint";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Checkbox, Field, focusFirstInvalid, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordExaminationDecisionAction } from "@/lib/actions/medical-contract";
import { addMonthsToKey, RECONCILE_FIELD } from "@/lib/domain/medical-flow";
import {
    EXAMINATION_DECISIONS,
    EXAMINATION_SCOPES,
    MEDICAL_TEXT_LIMITS,
    type ExaminationDecision,
    type ExaminationScope,
    type MedicalReviewRequest,
} from "@/lib/domain/medical-contract";
import type { ExaminationType } from "@/lib/domain/types";
import { addDaysToKey, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { plural, type Translator } from "@/lib/i18n/translate-client";
import type { CurrentExamination } from "@/lib/services/medical";
import { AssessmentsField, EMPTY_VITALS, ExaminationTypeField, FollowUpField, useAssessmentRows, useFollowUpDate, VitalsFields } from "./examination-details-fields";
import { vitalsDraftFrom } from "./examination-presets";
import { assessmentRowsProblem } from "./examination-presets";
import type { ProgressStep } from "./exam-progress";
import { ExamProgressRail } from "./exam-progress-rail";
import { DemoFillBar, FormPart } from "./form-parts";
import { findingsSummary } from "./findings-summary";
import { QuickFill } from "./quick-fill";
import { RestrictionFields } from "./restriction-fields";
import { Scat6BalanceFields, Scat6HistoryFields, Scat6MemoryFields, Scat6RecordInput, useScat6Draft } from "./scat6-fields";

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
    /** Development only: a one-click fill with plausible sample values, for presenting the flow. Nothing is saved until "Ghi phiếu khám". */
    demoFill?: boolean;
}

const scopeOptions = (t: Translator): ChoiceOption<ExaminationScope>[] =>
    EXAMINATION_SCOPES.map((value) => ({
        value,
        label: t(`doctorMedical.scope.${value}`),
        description: t(`doctorMedical.scopeDescription.${value}`),
    }));

const DECISION_META: Record<ExaminationDecision, Pick<ChoiceOption<ExaminationDecision>, "icon" | "tone">> = {
    ELIGIBLE: { icon: CircleCheck, tone: "success" },
    ELIGIBLE_WITH_RESTRICTIONS: { icon: ShieldAlert, tone: "warning" },
    NOT_ELIGIBLE: { icon: CircleSlash, tone: "danger" },
};

const decisionOptions = (t: Translator): ChoiceOption<ExaminationDecision>[] =>
    EXAMINATION_DECISIONS.map((value) => ({
        value,
        label: t(`doctorMedical.decision.${value}`),
        description: t(`doctorMedical.decisionDescription.${value}`),
        ...DECISION_META[value],
    }));

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
    demoFill = false,
}: ExaminationDecisionFormProps) {
    const t = useT();
    const locale = useLocale();
    const [type, setType] = useState<ExaminationType | "">(defaultType);
    const baseline = type === "baseline";
    const form = useActionForm(recordExaminationDecisionAction, {
        id: "exam-decision",
        hiddenFields: ["supersedesId", "scat6"],
        // One check of the whole form before sending, in the order the parts appear; the first problem is focused.
        prepare: () => {
            const message = formProblem();
            if (message) {
                window.requestAnimationFrame(() => form.formProps.ref.current && focusFirstInvalid(form.formProps.ref.current));
                return { status: "error", message };
            }
            const problems = baseline ? scat6.validateAll() : null;
            if (problems) return { status: "error", message: t("doctorMedical.exam.scat6Problems"), fieldErrors: problems };
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
    const followUp = useFollowUpDate(defaultType, nowInput.slice(0, 10));
    const [answered, setAnswered] = useState<string[]>(openReviewRequests.map((request) => request.id));

    const current = currentExaminations[scope];
    const answersRequests = scope === "TRAINING" && openReviewRequests.length > 0;
    const administered = scat6.draft.status === "ADMINISTERED";
    const examDay = examinedAt.slice(0, 10);
    const unconfirmed = form.state.status === "error" && form.state.data?.unconfirmed === true;

    /** The restriction lists as the form holds them now, read from the form itself (the pickers keep their own state). */
    const readRestrictions = () => {
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

    const stepProblem = (stepId: string): string | null => {
        if (stepId === "visit") {
            const entered = Object.values(vitals).filter((value) => value.trim() !== "").length;
            return !baseline && entered > 0 && entered < Object.keys(vitals).length ? t("doctorMedical.decision.vitalsPartial") : null;
        }
        if (stepId === "physical") {
            setCheckRows(true);
            return assessmentRowsProblem(t, rows.rows, { baseline });
        }
        if (stepId === "decision") {
            if (reason.trim().length < 10) return t("doctorMedical.decision.reasonShort");
            const lists = readRestrictions();
            if (lists) {
                if (lists.sessions?.length === 0) return t("doctorMedical.decision.noSessions");
                if (lists.techniques?.length === 0) return t("doctorMedical.decision.noTechniques");
                if (lists.sessions === null && lists.techniques === null && lists.joints.length === 0 && !lists.notes.trim()) return t("doctorMedical.decision.noLimits");
            }
        }
        return null;
    };

    /** The first problem anywhere in the form, part by part (SCAT6 answers are checked separately and marked in place). */
    const formProblem = (): string | null => stepProblem("visit") ?? stepProblem("physical") ?? stepProblem("decision");

    const vitalsCount = Object.values(vitals).filter((value) => value.trim() !== "").length;
    const namedRows = rows.rows.filter((row) => row.area.trim() !== "");
    const markedRows = namedRows.filter((row) => row.result !== "").length;
    const undescribed = namedRows.filter((row) => row.result === "abnormal" && !row.note.trim()).length;
    const reasoned = reason.trim().length >= 10;
    const progress: ProgressStep[] = [
        {
            key: "visit",
            label: t("doctorMedical.progress.visit"),
            pct: (type ? 0.5 : 0) + (examinedAt ? 0.5 : 0),
            state: type && examinedAt ? "done" : type || examinedAt ? "part" : "todo",
            text: type && examinedAt ? `${t(`doctorMedical.scope.${scope}`)} · ${examDay.slice(8, 10)}/${examDay.slice(5, 7)}` : t("doctorMedical.progress.chooseType"),
        },
        {
            key: "vitals",
            label: t("doctorMedical.progress.vitals"),
            pct: vitalsCount / 7,
            // Optional outside a baseline: empty is fine, partly filled is not.
            state: vitalsCount === 7 ? "done" : vitalsCount ? "part" : baseline ? "todo" : "done",
            text: vitalsCount || baseline ? `${vitalsCount}/7` : t("doctorMedical.decision.optional"),
        },
        {
            key: "physical",
            label: t("doctorMedical.progress.assess"),
            pct: namedRows.length ? (markedRows - undescribed / 2) / namedRows.length : baseline ? 0 : 1,
            state: undescribed ? "need" : namedRows.length && markedRows === namedRows.length ? "done" : markedRows ? "part" : baseline || namedRows.length ? "todo" : "done",
            text: undescribed ? t("doctorMedical.progress.toDescribe", { n: undescribed }) : namedRows.length ? `${markedRows}/${namedRows.length}` : t("doctorMedical.decision.noAreas"),
        },
        {
            key: "decision",
            label: t("doctorMedical.decision.title"),
            pct: (decision ? 0.5 : 0) + (reasoned ? 0.5 : 0),
            state: decision && reasoned ? "done" : decision || reasoned ? "part" : "todo",
            text: !decision ? t("doctorMedical.progress.notChosen") : !reasoned ? t("doctorMedical.decision.missingReason") : t(`doctorMedical.decision.${decision}`),
        },
    ];

    /** Development only: plausible values the doctor can still edit; "Xóa hết" empties them again. */
    const fillSample = () => {
        setVitals({ weightKg: weightLimitKg ? (weightLimitKg - 0.4).toFixed(1) : "70.0", restingHeartRate: "58", bloodPressureSystolic: "118", bloodPressureDiastolic: "76", temperatureC: "36.6", spo2Pct: "98", hydration: "good" });
        rows.rows.forEach((_, index) => rows.update(index, { result: "normal", note: "" }));
        setDecision("ELIGIBLE");
        setReason(t("doctorMedical.decision.sampleReason"));
        setRecommendations(t("doctorMedical.decision.sampleRecommendations"));
        followUp.set(addDaysToKey(examDay, 28));
        ["decision", "reason", "recommendations"].forEach((name) => form.markEdited(name));
    };
    const clearAll = () => {
        setVitals(EMPTY_VITALS);
        rows.reset(type);
        setDecision("");
        setReason("");
        setRecommendations("");
    };

    const insertSummary = () => {
        const summary = findingsSummary(t, {
            type,
            vitals,
            assessments: rows.rows,
            scat6: baseline ? { status: scat6.draft.status, reason: scat6.draft.notAdministeredReason } : null,
        });
        if (!summary) {
            setReasonNote(t("doctorMedical.decision.nothingToSummarise"));
            return;
        }
        if (reason.includes(summary)) return;
        setReason(reason.trim() ? `${reason.trimEnd()}\n\n${summary}` : summary);
        setReasonNote(t("doctorMedical.decision.summaryInserted"));
        form.markEdited("reason");
    };

    return (
        <form {...form.formProps} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <input type="hidden" name="fighterId" value={fighter.id} />
            <input type="hidden" name="knownCurrentId" value={current?.id ?? ""} />
            {unconfirmed && <input type="hidden" name={RECONCILE_FIELD} value="1" />}
            {baseline && <Scat6RecordInput scat6={scat6} />}
            {demoFill && (
                <DemoFillBar
                    className="xl:col-span-2"
                    title={t("doctorMedical.decision.demoTitle")}
                    description={t("doctorMedical.decision.demoDescription")}
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="exam-" id="visit" title={t("doctorMedical.progress.visit")} description={t("doctorMedical.decision.visitDescription")}>
                    <ChoiceGroup
                        id="exam-decision-scope"
                        name="scope"
                        legend={t("doctorMedical.decision.scope")}
                        required
                        columns={2}
                        variant="compact"
                        options={scopeOptions(t)}
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
                                followUp.typeChanged(next);
                            }}
                        />
                        <Field label={t("doctorMedical.decision.examinedAt")} htmlFor={control("examinedAt").id} error={error("examinedAt")} required hint={t("doctorMedical.exam.academyTime")}>
                            <Input {...control("examinedAt", { hint: true, required: true })} type="datetime-local" value={examinedAt} max={nowInput} onChange={(event) => setExaminedAt(event.target.value)} />
                        </Field>
                    </div>
                    {baseline && scope === "COMPETITION" && (
                        <Callout tone="warning" icon={TriangleAlert} title={t("doctorMedical.decision.competitionBaselineTitle")}>
                            {t("doctorMedical.decision.competitionBaselineBody", { name: fighter.name })}
                        </Callout>
                    )}
                    {current && (
                        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px]">
                            <p className="text-fg-muted">
                                {t("doctorMedical.decision.currentPrefix", { scope: t(`doctorMedical.scope.${scope}`).toLowerCase() })}{" "}
                                <span className="font-medium text-fg">{t(`doctorMedical.decision.${current.decision}`)}</span> {t("doctorMedical.decision.currentOn")}{" "}
                                <time dateTime={current.examinedAt}>{formatDateTime(current.examinedAt)}</time>
                                {current.validUntil && t("doctorMedical.decision.currentValidUntil", { date: formatDate(current.validUntil) })}
                            </p>
                            <input type="hidden" name="supersedesId" value={current.id} />
                            <Checkbox
                                id="exam-decision-correction"
                                name="correction"
                                checked={correcting}
                                onChange={(event) => setCorrecting(event.target.checked)}
                                label={t("doctorMedical.decision.correctionLabel")}
                                description={t("doctorMedical.decision.correctionDescription")}
                                info={<TermHint term="examinationCorrection" />}
                            />
                            {error("supersedesId") && <p className="font-medium text-danger-fg">{error("supersedesId")}</p>}
                        </div>
                    )}
                </FormPart>

                <FormPart
                    prefix="exam-"
                    id="vitals"
                    title={t("doctorMedical.progress.vitals")}
                    description={baseline ? t("doctorMedical.decision.vitalsBaseline") : t("doctorMedical.decision.vitalsOptional")}
                    aside={t("doctorMedical.exam.vitalsAside", { count: `${vitalsCount}/7` })}
                >
                    <VitalsFields
                        form={form}
                        value={vitals}
                        onChange={setVitals}
                        weightLimitKg={weightLimitKg}
                        required={baseline}
                        previous={vitalsDraftFrom(Object.values(currentExaminations).find((exam) => exam?.details?.vitals)?.details?.vitals)}
                    />
                </FormPart>

                <FormPart
                    prefix="exam-"
                    id="physical"
                    title={t("doctorMedical.progress.assess")}
                    description={baseline ? t("doctorMedical.decision.assessBaseline") : t("doctorMedical.decision.assessOptional")}
                    aside={namedRows.length ? t("doctorMedical.exam.assessAside", { count: `${markedRows}/${namedRows.length}` }) : undefined}
                >
                    <AssessmentsField form={form} type={type} rows={rows} checkMissing={checkRows} />
                </FormPart>

                {baseline && (
                    <div className="px-5 py-6 sm:px-7">
                        <Scat6HistoryFields scat6={scat6} />
                        {administered && (
                            <>
                                <Scat6MemoryFields scat6={scat6} />
                                <Scat6BalanceFields scat6={scat6} />
                            </>
                        )}
                    </div>
                )}

                <FormPart prefix="exam-" id="decision" title={t("doctorMedical.decision.title")} description={t("doctorMedical.decision.description")}>
                    <ChoiceGroup
                        id="exam-decision-decision"
                        name="decision"
                        legend={t("doctorMedical.decision.title")}
                        required
                        columns={3}
                        options={decisionOptions(t)}
                        value={decision}
                        onChange={setDecision}
                        error={error("decision")}
                        hint={t("doctorMedical.decision.hint")}
                    />
                    {decision === "NOT_ELIGIBLE" && (
                        <Callout tone="danger" icon={TriangleAlert} title={t("doctorMedical.decision.revokedTitle", { scope: t(`doctorMedical.scope.${scope}`).toLowerCase() })}>
                            {scope === "TRAINING"
                                ? t("doctorMedical.decision.stopsTraining", { name: fighter.name })
                                : t("doctorMedical.decision.stopsCompeting", { name: fighter.name })}
                        </Callout>
                    )}
                    <div className="flex flex-col gap-2">
                        <Field
                            label={t("doctorMedical.decision.reasonLabel")}
                            htmlFor={control("reason").id}
                            error={error("reason")}
                            required
                            info={<TermHint term="findingsAndReasoning" />}
                            hint={t("doctorMedical.decision.reasonHint")}
                        >
                            <Textarea
                                {...control("reason", { hint: true, required: true })}
                                rows={5}
                                maxLength={MEDICAL_TEXT_LIMITS.examinationReason}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                            />
                        </Field>
                        <QuickFill label={t("doctorMedical.decision.insertSummary")} icon={FileText} available note={reasonNote} onClick={insertSummary} />
                    </div>
                    {decision !== "NOT_ELIGIBLE" && (
                        <div className="flex flex-col gap-2">
                            <Field
                                label={t("doctorMedical.decision.validUntilLabel")}
                                htmlFor={control("validUntil").id}
                                error={error("validUntil")}
                                optional
                                info={<TermHint term="validUntil" />}
                                hint={t("doctorMedical.decision.validUntilHint")}
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
                                        label={t("doctorMedical.decision.validFor")}
                                        suggestions={VALIDITY_PICKS.map((months) => ({ label: plural(t, "doctorMedical.decision.months", months), value: addMonthsToKey(examDay, months) }))}
                                        onPick={(value) => {
                                            setValidUntil(value);
                                            form.markEdited("validUntil");
                                        }}
                                    />
                                    {validUntil && (
                                        <Button variant="ghost" size="sm" onClick={() => setValidUntil("")}>
                                            {t("doctorMedical.decision.noEnd")}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {decision === "ELIGIBLE_WITH_RESTRICTIONS" && (
                        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                                {t("doctorMedical.decision.restrictions")} <TermHint term="restrictions" />
                            </p>
                            <p className="-mt-3 text-[13px] text-fg-muted">{t("doctorMedical.decision.restrictionsIntro")}</p>
                            <RestrictionFields form={form} idPrefix="exam-decision" />
                            <Field
                                label={t("doctorMedical.decision.restrictionNotes")}
                                htmlFor={control("restrictionNotes").id}
                                error={error("restrictionNotes")}
                                optional
                                hint={t("doctorMedical.decision.restrictionNotesHint")}
                            >
                                <Textarea {...control("restrictionNotes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.restrictionNotes} />
                            </Field>
                            {error("restrictions") && (
                                <p data-invalid="true" className="text-[13px] font-medium text-danger-fg">
                                    {error("restrictions")}
                                </p>
                            )}
                        </div>
                    )}
                    <Field label={t("doctorMedical.exam.recommendationsLabel")} htmlFor={control("recommendations").id} error={error("recommendations")} optional hint={t("doctorMedical.decision.recommendationsHint")}>
                        <Textarea
                            {...control("recommendations", { hint: true })}
                            rows={3}
                            maxLength={MEDICAL_TEXT_LIMITS.clinicalText}
                            value={recommendations}
                            onChange={(event) => setRecommendations(event.target.value)}
                        />
                    </Field>
                    <FollowUpField form={form} examDay={examDay} value={followUp.value} onChange={followUp.set} hint={t("doctorMedical.exam.followUpHint")} />
                    {answersRequests && (
                        <fieldset
                            aria-invalid={error("reviewRequestIds") ? true : undefined}
                            data-invalid={error("reviewRequestIds") ? "true" : undefined}
                            className="flex flex-col gap-2.5 rounded-lg border border-border p-4"
                        >
                            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-fg">
                                {t("doctorMedical.decision.requestsLegend")} <TermHint term="reviewRequest" />
                            </legend>
                            <p className="text-[13px] text-fg-muted">{t("doctorMedical.decision.requestsIntro")}</p>
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
                                    description={t("doctorMedical.decision.requestSent", { when: formatRelative(request.requestedAt, now, locale).toLowerCase() })}
                                />
                            ))}
                            {error("reviewRequestIds") && <p className="text-[13px] font-medium text-danger-fg">{error("reviewRequestIds")}</p>}
                        </fieldset>
                    )}
                </FormPart>
            </Card>

            <div className="xl:sticky xl:top-32">
                <ExamProgressRail
                    steps={progress}
                    anchorPrefix="exam-"
                    actions={
                        <>
                            <FormMessage {...form.message} />
                            <SubmitButton pending={form.pending} pendingLabel={unconfirmed ? t("doctorMedical.checkingRecord") : t("doctorMedical.recording")} className="w-full">
                                {unconfirmed ? t("doctorMedical.retry") : t("doctorMedical.decision.submit")}
                            </SubmitButton>
                            <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                                {t("doctorMedical.cancel")}
                            </Link>
                        </>
                    }
                    footer={
                        <InlineNote icon={Info}>
                            {t("doctorMedical.decision.footerImmutable")}{" "}
                            {decision === "NOT_ELIGIBLE"
                                ? scope === "TRAINING"
                                    ? t("doctorMedical.decision.footerStopsTraining", { name: fighter.name })
                                    : t("doctorMedical.decision.footerStopsCompeting", { name: fighter.name })
                                : t("doctorMedical.decision.footerNext")}
                        </InlineNote>
                    }
                />
            </div>
        </form>
    );
}
