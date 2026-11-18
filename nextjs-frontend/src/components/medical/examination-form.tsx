"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createExaminationAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { ExaminationOutcome, ExaminationType, Vitals } from "@/lib/domain/types";
import { addDaysToKey, formatDate, formatNumber } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME, EXAMINATION_OUTCOME_DESCRIPTION_KEYS, EXAMINATION_OUTCOME_META, ExaminationOutcomeBadge } from "./clinical-badges";
import { AssessmentsField, EMPTY_VITALS, ExaminationTypeField, FollowUpField, useAssessmentRows, useFollowUpDate, VitalsFields } from "./examination-details-fields";
import { examProgress } from "./exam-progress";
import { ExamProgressRail } from "./exam-progress-rail";
import { DemoFillBar, FormPart } from "./form-parts";
import { badgeLocale, defaultExaminationType, localExaminationTitle, localLabel, vitalsDraftFrom } from "./examination-presets";
import { Scat6BalanceFields, Scat6HistoryFields, Scat6MemoryFields, Scat6RecordInput, useScat6Draft } from "./scat6-fields";

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
    /** Where "Hủy" goes; the examinations list unless the form was opened from a fighter's profile. */
    cancelHref?: string;
    /** Opened from the fighter's profile: the fighter is fixed and the profile header already introduces them. */
    fighterLocked?: boolean;
    /** Demo mode: offer a one-click fill with plausible sample values, for presenting the flow. */
    demoFill?: boolean;
}

const outcomeOptions = (t: Translator): ChoiceOption<ExaminationOutcome>[] =>
    (Object.keys(EXAMINATION_OUTCOME_LABELS) as ExaminationOutcome[]).map((value) => ({
    value,
    label: localLabel(t, `examinationOutcome.${value}`, EXAMINATION_OUTCOME_LABELS[value]),
    description: t(EXAMINATION_OUTCOME_DESCRIPTION_KEYS[value]),
    icon: EXAMINATION_OUTCOME_META[value].icon,
    tone: EXAMINATION_OUTCOME_META[value].tone,
}));
/** Records a medical examination: patient and visit, vitals with live reference ranges, assessments and outcome. */
export function ExaminationForm({
    fighters,
    defaultFighterId,
    defaultType,
    defaultDateTime,
    cancelHref = routes.doctor.examinations,
    fighterLocked = false,
    demoFill = false,
}: ExaminationFormProps) {
    const t = useT();
    const initialFighter = fighters.find((candidate) => candidate.id === defaultFighterId) ?? null;
    // Without a type in the link, a chosen fighter starts on a baseline (never examined) or a routine check.
    const initialType: ExaminationType | "" = defaultType || (initialFighter ? defaultExaminationType(initialFighter.lastExamination !== null) : "");
    const [type, setType] = useState<ExaminationType | "">(initialType);
    const form = useActionForm(createExaminationAction, {
        id: "exam",
        hiddenFields: ["scat6"],
        // A SCAT6 answer left blank (or a tick row nobody marked) is marked in place instead of being sent as "none".
        prepare: () => {
            const problems = type === "baseline" ? scat6.validateAll() : null;
            if (problems) return { status: "error", message: t("doctorMedical.exam.scat6Problems"), fieldErrors: problems };
        },
    });
    const id = (name: string) => `exam-${name}`;
    const { error } = form;

    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [date, setDate] = useState(defaultDateTime);
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const rows = useAssessmentRows(form, initialType);
    const [outcome, setOutcome] = useState<ExaminationOutcome | "">("");
    const [summary, setSummary] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const followUp = useFollowUpDate(initialType, defaultDateTime.slice(0, 10));

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const scat6 = useScat6Draft({ form, nowInput: defaultDateTime, dateOfBirth: fighter?.dateOfBirth ?? null });
    const examDay = date.slice(0, 10);

    const changeType = (next: ExaminationType | "") => {
        setType(next);
        rows.typeChanged(next);
        followUp.typeChanged(next);
    };

    const steps = examProgress(t, { date, type, vitals, rows: rows.rows, outcome, summary, recommendations });
    const last = fighter?.lastExamination ?? null;

    /** Demo only: fills every part with plausible values the doctor can still edit; "Xóa hết" empties them again. */
    const fillSample = () => {
        const limit = fighter?.weightLimitKg;
        setVitals({
            weightKg: limit ? (limit - 0.4).toFixed(1) : "70.0",
            restingHeartRate: "58",
            bloodPressureSystolic: "118",
            bloodPressureDiastolic: "76",
            temperatureC: "36.6",
            spo2Pct: "98",
            hydration: "good",
        });
        rows.rows.forEach((_, index) => rows.update(index, { result: "normal", note: "" }));
        setOutcome("fit");
        setSummary(t("doctorMedical.exam.sampleSummary"));
        setRecommendations(t("doctorMedical.exam.sampleRecommendations"));
        followUp.set(addDaysToKey(examDay, 28));
        form.markEdited("summary");
        form.markEdited("recommendations");
        form.markEdited("outcome");
    };
    const clearAll = () => {
        setVitals(EMPTY_VITALS);
        rows.reset(type);
        setOutcome("");
        setSummary("");
        setRecommendations("");
    };

    const currentLevel = fighter && (fighter.clearanceState === "full" || fighter.clearanceState === "restricted" || fighter.clearanceState === "not_cleared") ? fighter.clearanceState : null;
    const outcomeMismatch = fighter && outcome ? currentLevel !== CLEARANCE_LEVEL_FOR_OUTCOME[outcome] : false;

    return (
        <form {...form.formProps} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {fighterLocked && <input type="hidden" name="fighterId" value={fighterId} />}
            {demoFill && (
                <DemoFillBar
                    className="xl:col-span-2"
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="exam-" id="visit" title={t("doctorMedical.progress.visit")}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {!fighterLocked && (
                            <Field label={t("doctorMedical.exam.fighter")} htmlFor={id("fighterId")} error={error("fighterId")} required className="sm:col-span-2 sm:max-w-sm">
                                <Select {...form.control("fighterId", { required: true })} value={fighterId} onChange={(event) => setFighterId(event.target.value)}>
                                    <option value="">{t("doctorMedical.exam.chooseFighter")}</option>
                                    {fighters.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        )}
                        <Field label={t("doctorMedical.exam.dateTime")} htmlFor={id("date")} error={error("date")} required hint={t("doctorMedical.exam.academyTime")}>
                            <Input
                                {...form.control("date", { hint: true, required: true })}
                                type="datetime-local"
                                value={date}
                                max={defaultDateTime}
                                onChange={(event) => setDate(event.target.value)}
                            />
                        </Field>
                        <ExaminationTypeField form={form} value={type} onChange={changeType} />
                    </div>
                    {!fighterLocked && <PatientContext fighter={fighter} />}
                </FormPart>

                <FormPart
                    prefix="exam-"
                    id="vitals"
                    title={t("doctorMedical.progress.vitals")}
                    description={t("doctorMedical.exam.vitalsDescription")}
                    aside={t("doctorMedical.exam.vitalsAside", { count: steps[1]!.text })}
                >
                    <VitalsFields
                        form={form}
                        value={vitals}
                        onChange={setVitals}
                        weightLimitKg={fighter?.weightLimitKg ?? null}
                        required
                        previous={vitalsDraftFrom(last?.vitals)}
                        previousLabel={
                            last && (
                                <>
                                    {t("doctorMedical.exam.previousPrefix")} <b className="font-semibold text-fg">{localExaminationTitle(t, last)}</b> · {formatDate(last.date)}
                                </>
                            )
                        }
                    />
                </FormPart>

                <FormPart
                    prefix="exam-"
                    id="assess"
                    title={t("doctorMedical.progress.assess")}
                    description={t("doctorMedical.exam.assessDescription")}
                    aside={steps[2]!.state === "need" ? undefined : t("doctorMedical.exam.assessAside", { count: steps[2]!.text })}
                >
                    <AssessmentsField form={form} type={type} rows={rows} />
                </FormPart>

                {type === "baseline" && (
                    <div className="px-5 py-6 sm:px-7">
                        <Scat6RecordInput scat6={scat6} />
                        <Scat6HistoryFields scat6={scat6} />
                        {scat6.draft.status === "ADMINISTERED" && (
                            <>
                                <Scat6MemoryFields scat6={scat6} />
                                <Scat6BalanceFields scat6={scat6} />
                            </>
                        )}
                    </div>
                )}

                <FormPart prefix="exam-" id="decide" title={t("doctorMedical.exam.decideTitle")}>
                    <div>
                        <ChoiceGroup
                            id={id("outcome")}
                            name="outcome"
                            legend={t("doctorMedical.progress.decide")}
                            required
                            columns={3}
                            options={outcomeOptions(t)}
                            value={outcome}
                            onChange={setOutcome}
                            error={error("outcome")}
                        />
                        <div aria-live="polite">
                            {fighter && outcome && (
                                <InlineNote icon={Info} tone={outcomeMismatch ? "info" : "neutral"} className="mt-2">
                                    {outcomeMismatch
                                        ? t("doctorMedical.exam.outcomeMismatch", {
                                              level: localLabel(t, `clearanceLevel.${CLEARANCE_LEVEL_FOR_OUTCOME[outcome]}`, CLEARANCE_LEVEL_LABELS[CLEARANCE_LEVEL_FOR_OUTCOME[outcome]]),
                                              name: fighter.name,
                                              current: currentLevel
                                                  ? t("doctorMedical.exam.currentLevel", { level: localLabel(t, `clearanceLevel.${currentLevel}`, CLEARANCE_LEVEL_LABELS[currentLevel]) })
                                                  : fighter.clearanceState === "expired"
                                                    ? t("doctorMedical.exam.currentExpired")
                                                    : t("doctorMedical.exam.currentNone"),
                                          })
                                        : t("doctorMedical.exam.outcomeMatches")}
                                </InlineNote>
                            )}
                        </div>
                    </div>

                    <Field label={t("doctorMedical.exam.summaryLabel")} htmlFor={id("summary")} error={error("summary")} required hint={t("doctorMedical.exam.summaryHint")}>
                        <Textarea
                            {...form.control("summary", { hint: true, required: true })}
                            rows={3}
                            placeholder={t("doctorMedical.exam.summaryPlaceholder")}
                            value={summary}
                            onChange={(event) => setSummary(event.target.value)}
                        />
                    </Field>
                    <Field label={t("doctorMedical.exam.recommendationsLabel")} htmlFor={id("recommendations")} error={error("recommendations")} required hint={t("doctorMedical.exam.recommendationsHint")}>
                        <Textarea
                            {...form.control("recommendations", { hint: true, required: true })}
                            rows={3}
                            placeholder={t("doctorMedical.exam.recommendationsPlaceholder")}
                            value={recommendations}
                            onChange={(event) => setRecommendations(event.target.value)}
                        />
                    </Field>
                    <FollowUpField form={form} examDay={examDay} value={followUp.value} onChange={followUp.set} hint={t("doctorMedical.exam.followUpHint")} />
                </FormPart>
            </Card>

            <div className="xl:sticky xl:top-32">
                <ExamProgressRail
                    steps={steps}
                    actions={
                        <>
                            <FormMessage {...form.message} />
                            <Button type="submit" loading={form.pending} className="w-full">
                                {form.pending ? t("doctorMedical.exam.saving") : t("doctorMedical.exam.save")}
                            </Button>
                            <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                                {t("doctorMedical.cancel")}
                            </Link>
                        </>
                    }
                    footer={
                        <>
                            <p className="mb-1 font-semibold text-fg-muted">{t("doctorMedical.afterSaving")}</p>
                            {t("doctorMedical.exam.afterSaving")}
                        </>
                    }
                />
            </div>
        </form>
    );
}


function PatientContext({ fighter }: { fighter: ExamFighterOption | null }) {
    const t = useT();
    if (!fighter) {
        return <p className="rounded-lg bg-surface-muted px-4 py-3 text-[13px] text-fg-muted">{t("doctorMedical.exam.chooseFighterFirst")}</p>;
    }
    const last = fighter.lastExamination;
    return (
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-muted px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="flex min-w-0 flex-col gap-2">
                <FighterIdentity fighter={fighter} size="sm" />
                <div className="flex flex-wrap gap-1.5">
                    <HealthStatusBadge locale={badgeLocale(t)} status={fighter.healthStatus} size="sm" />
                    <ClearanceBadge locale={badgeLocale(t)} state={fighter.clearanceState} size="sm" />
                </div>
                {fighter.clearanceValidUntil && fighter.clearanceState !== "none" && (
                    <p className="text-xs text-fg-muted">
                        {fighter.clearanceState === "expired"
                            ? t("doctorMedical.exam.clearanceExpired", { date: formatDate(fighter.clearanceValidUntil) })
                            : t("doctorMedical.exam.clearanceValidUntil", { date: formatDate(fighter.clearanceValidUntil) })}
                    </p>
                )}
            </div>
            <div className="min-w-0 text-[13px]">
                {last ? (
                    <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
                            {t("doctorMedical.exam.lastPrefix")} <span className="font-medium text-fg">{localExaminationTitle(t, last)}</span>
                            <span>{formatDate(last.date)}</span>
                            <ExaminationOutcomeBadge locale={badgeLocale(t)} outcome={last.outcome} size="sm" />
                        </p>
                        {last.vitals && (
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
                                <div className="flex gap-1">
                                    <dt>{t("doctorMedical.vitals.weight")}</dt>
                                    <dd className="font-medium text-fg">{formatNumber(last.vitals.weightKg, 1)} kg</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>{t("doctorMedical.vitals.heartRate")}</dt>
                                    <dd className="font-medium text-fg">{last.vitals.restingHeartRate} bpm</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>{t("doctorMedical.vitals.bloodPressure")}</dt>
                                    <dd className="font-medium text-fg">
                                        {last.vitals.bloodPressureSystolic}/{last.vitals.bloodPressureDiastolic}
                                    </dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt>{t("doctorMedical.exam.classLimit")}</dt>
                                    <dd className="font-medium text-fg">{formatNumber(fighter.weightLimitKg, 1)} kg</dd>
                                </div>
                            </dl>
                        )}
                    </>
                ) : (
                    <p className="text-fg-muted">{t("doctorMedical.exam.noExamYet")}</p>
                )}
            </div>
        </div>
    );
}
