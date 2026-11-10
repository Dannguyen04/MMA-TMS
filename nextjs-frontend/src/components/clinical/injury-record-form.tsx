"use client";

import Link from "next/link";
import { useState } from "react";

import { RegionModel } from "@/components/doctor/region-model";
import { useT } from "@/components/i18n/locale-provider";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm, type ActionForm } from "@/components/ui/use-action-form";
import { recordInjuryAction } from "@/lib/actions/medical-contract";
import { API_INJURY_SEVERITIES, MEDICAL_TEXT_LIMITS, type ApiInjurySeverity, type BodyJoint } from "@/lib/domain/medical-contract";
import type { InjurySeverity } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n/translate";
import { addDaysToKey, toDateTimeInputValue } from "@/lib/format";
import type { ProgressStep } from "@/components/medical/exam-progress";
import { ExamProgressRail } from "@/components/medical/exam-progress-rail";
import { DemoFillBar, DoctorsOnly, FormPart, useWideLayout } from "@/components/medical/form-parts";
import { INJURY_SEVERITY_DESCRIPTIONS, jointText, severityText } from "./clinical-copy";

export interface InjuryRecordFormProps {
    fighters: { id: string; name: string }[];
    defaultFighterId: string;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    cancelHref: string;
    /** Opened from the fighter's profile: the fighter is fixed and the profile header already introduces them. */
    fighterLocked?: boolean;
    /** Development only: a one-click fill with a plausible sample injury. Nothing is saved until "Ghi nhận chấn thương". */
    demoFill?: boolean;
}

const JOINT_GROUPS: { label: MessageKey; joints: BodyJoint[] }[] = [
    { label: "doctorClinical.recordForm.upperBody", joints: ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW", "LEFT_WRIST", "RIGHT_WRIST"] },
    { label: "doctorClinical.regionGroup.trunk", joints: ["SPINE_CORE"] },
    { label: "doctorClinical.recordForm.lowerBody", joints: ["LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE"] },
];

const severityKey = (value: ApiInjurySeverity) => value.toLowerCase() as InjurySeverity;


/**
 * When the injury happened, as a day and a time that start at the moment the form opened. "Now", "Today" and
 * "Yesterday" change them in one tap ("Today" and "Yesterday" change only the day); the action reads the combined value.
 */
function OccurredAtField({ form, maxDay, nowInput }: { form: Pick<ActionForm<unknown>, "control" | "error" | "markEdited">; maxDay: string; nowInput: string }) {
    const t = useT();
    const [day, setDay] = useState(nowInput.slice(0, 10));
    const [time, setTime] = useState(nowInput.slice(11, 16));
    const control = form.control("occurredAt", { hint: true, required: true });
    const message = form.error("occurredAt");
    const pick = (value: string) => {
        const now = toDateTimeInputValue(new Date());
        if (value === "now") {
            setDay(now.slice(0, 10));
            setTime(now.slice(11));
        } else {
            setDay(value === "today" ? now.slice(0, 10) : addDaysToKey(now.slice(0, 10), -1));
        }
        form.markEdited("occurredAt");
    };
    return (
        <Field label={t("doctorClinical.common.occurred")} htmlFor={control.id} error={message} required hint={t("doctorClinical.common.academyTime")}>
            <div className="flex flex-col gap-2">
                <input type="hidden" name="occurredAt" value={day && time ? `${day}T${time}` : ""} />
                <div className="flex flex-wrap items-center gap-2">
                    <Input {...control} name={undefined} type="date" value={day} max={maxDay} onChange={(event) => setDay(event.target.value)} className="w-44" />
                    <Input
                        id={`${control.id}-time`}
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        aria-label={t("doctorClinical.recordForm.timeLabel")}
                        aria-invalid={message ? true : undefined}
                        aria-required
                        className="w-32"
                    />
                </div>
                <SuggestionChips
                    label={t("doctorClinical.recordForm.quickPick")}
                    suggestions={[
                        { label: t("doctorClinical.recordForm.now"), value: "now" },
                        { label: t("doctorClinical.recordForm.today"), value: "today" },
                        { label: t("doctorClinical.recordForm.yesterday"), value: "yesterday" },
                    ]}
                    onPick={pick}
                />
            </div>
        </Field>
    );
}

/** Records an injury as the medical service keeps it: the affected joint, the diagnosis in words, severity and when it happened. */
export function InjuryRecordForm({ fighters, defaultFighterId, nowInput, cancelHref, fighterLocked = false, demoFill = false }: InjuryRecordFormProps) {
    const t = useT();
    const form = useActionForm(recordInjuryAction, { id: "injury-record" });
    const severityOptions: ChoiceOption<ApiInjurySeverity>[] = API_INJURY_SEVERITIES.map((value) => ({
        value,
        label: severityText(t, severityKey(value)),
        description: t(INJURY_SEVERITY_DESCRIPTIONS[severityKey(value)]),
        icon: INJURY_SEVERITY_META[severityKey(value)].icon,
        tone: INJURY_SEVERITY_META[severityKey(value)].tone,
    }));
    const { control, error } = form;
    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [joint, setJoint] = useState<BodyJoint | "">("");
    const [severity, setSeverity] = useState<ApiInjurySeverity | "">("");
    const [injuryType, setInjuryType] = useState("");
    const [description, setDescription] = useState("");

    const parts = [joint !== "", injuryType.trim() !== "", severity !== ""].filter(Boolean).length;
    const steps: ProgressStep[] = [
        {
            key: "injury",
            label: t("doctorClinical.common.injury"),
            pct: parts / 3,
            state: parts === 3 ? "done" : parts ? "part" : "todo",
            text: severity
                ? severityText(t, severityKey(severity))
                : !joint
                  ? t("doctorClinical.recordForm.stepChooseJoint")
                  : !injuryType.trim()
                    ? t("doctorClinical.recordForm.stepDiagnosis")
                    : t("doctorClinical.common.chooseSeverity"),
        },
        // The time starts at the moment the form opened, so it is always set.
        { key: "time", label: t("doctorClinical.recordForm.time"), pct: 1, state: "done", text: t("doctorClinical.recordForm.timeSet") },
        {
            key: "clinical",
            label: t("doctorClinical.common.clinicalSigns"),
            pct: description.trim() ? 1 : 0,
            state: description.trim() ? "done" : "todo",
            text: description.trim() ? t("doctorClinical.common.described") : t("doctorClinical.recordForm.optional"),
        },
    ];

    // One 3D model only (each is a WebGL context): in the side column on wide screens, in the form otherwise.
    const wide = useWideLayout();
    const model = <RegionModel targets={[{ joint }]} label={injuryType || undefined} height={300} emptyText={t("doctorClinical.recordForm.noJoint")} legend={false} />;

    /** Development only: a plausible sample injury the doctor can still edit; "Xóa hết" empties the form again. */
    const fillSample = () => {
        setJoint("RIGHT_KNEE");
        setInjuryType(t("doctorClinical.recordForm.sampleType"));
        setSeverity("MODERATE");
        setDescription(t("doctorClinical.recordForm.sampleDescription"));
        ["affectedJoint", "injuryType", "severity", "description"].forEach((name) => form.markEdited(name));
    };
    const clearAll = () => {
        setJoint("");
        setInjuryType("");
        setSeverity("");
        setDescription("");
    };

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {fighterLocked && <input type="hidden" name="fighterId" value={fighterId} />}
            {demoFill && (
                <DemoFillBar
                    className="xl:col-span-2"
                    title={t("doctorClinical.recordForm.demoTitle")}
                    description={t("doctorClinical.recordForm.demoDescription")}
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="injury-" id="injury" title={t("doctorClinical.common.injury")} description={t("doctorClinical.recordForm.injuryPartDescription")}>
                    {!fighterLocked && (
                        <Field label={t("doctorClinical.common.fighter")} htmlFor={control("fighterId").id} error={error("fighterId")} required className="sm:max-w-sm">
                            <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => setFighterId(event.target.value)}>
                                <option value="">{t("doctorClinical.common.chooseFighter")}</option>
                                {fighters.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    )}
                    <div className="grid min-w-0 grid-cols-1 items-start gap-5 sm:grid-cols-2">
                        <Field label={t("doctorClinical.recordForm.joint")} htmlFor={control("affectedJoint").id} error={error("affectedJoint")} required hint={t("doctorClinical.common.sideHint")}>
                            <Select {...control("affectedJoint", { hint: true, required: true })} value={joint} onChange={(event) => setJoint(event.target.value as BodyJoint | "")}>
                                <option value="">{t("doctorClinical.recordForm.chooseJoint")}</option>
                                {JOINT_GROUPS.map((group) => (
                                    <optgroup key={group.label} label={t(group.label)}>
                                        {group.joints.map((value) => (
                                            <option key={value} value={value}>
                                                {jointText(t, value)}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </Select>
                        </Field>
                        <Field label={t("doctorClinical.common.diagnosis")} htmlFor={control("injuryType").id} error={error("injuryType")} required hint={t("doctorClinical.recordForm.diagnosisHint")}>
                            <Input {...control("injuryType", { hint: true, required: true })} value={injuryType} onChange={(event) => setInjuryType(event.target.value)} maxLength={MEDICAL_TEXT_LIMITS.injuryType} />
                        </Field>
                    </div>
                    {!wide && <div className="rounded-lg bg-surface-muted/60 px-2 py-2">{model}</div>}
                    <ChoiceGroup id="injury-record-severity" name="severity" legend={t("doctorClinical.common.severity")} required columns={2} options={severityOptions} value={severity} onChange={setSeverity} error={error("severity")} />
                </FormPart>

                <FormPart prefix="injury-" id="time" title={t("doctorClinical.recordForm.time")} description={t("doctorClinical.recordForm.timeDescription")}>
                    <OccurredAtField form={form} maxDay={nowInput.slice(0, 10)} nowInput={nowInput} />
                </FormPart>

                <FormPart
                    prefix="injury-"
                    id="clinical"
                    title={t("doctorClinical.common.clinicalSigns")}
                    description={t("doctorClinical.recordForm.clinicalDescription")}
                    aside={<DoctorsOnly>{t("doctorClinical.common.doctorsOnly")}</DoctorsOnly>}
                >
                    <Field label={t("doctorClinical.common.description")} htmlFor={control("description").id} error={error("description")} optional hint={t("doctorClinical.recordForm.clinicalHint")}>
                        <Textarea
                            {...control("description", { hint: true })}
                            rows={4}
                            maxLength={MEDICAL_TEXT_LIMITS.clinicalText}
                            placeholder={t("doctorClinical.recordForm.descriptionPlaceholder")}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </Field>
                </FormPart>
            </Card>

            <div className="xl:sticky xl:top-32">
                <ExamProgressRail
                    steps={steps}
                    title={t("doctorClinical.common.progress")}
                    label={t("doctorClinical.common.injuryProgress")}
                    anchorPrefix="injury-"
                    top={wide ? <div className="px-4 py-4">{model}</div> : undefined}
                    actions={
                        <>
                            <FormMessage {...form.message} />
                            <SubmitButton pending={form.pending} pendingLabel={t("doctorClinical.common.recordingInjury")} className="w-full">
                                {t("doctorClinical.common.recordInjury")}
                            </SubmitButton>
                            <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                                {t("doctorClinical.common.cancel")}
                            </Link>
                        </>
                    }
                />
            </div>
        </form>
    );
}
