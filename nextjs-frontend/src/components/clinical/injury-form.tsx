"use client";

import { Activity, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AINotice } from "@/components/domain/ai-notice";
import { RegionModel } from "@/components/doctor/region-model";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createInjuryAction } from "@/lib/actions/clinical";
import { INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { AbnormalMovementAlert, BodyRegion, InjuryMechanism, InjurySeverity, InjuryType } from "@/lib/domain/types";
import { addDaysToKey, daysBetweenKeys, formatShortDate } from "@/lib/format";
import { plural } from "@/lib/i18n/translate-client";
import {
    BODY_REGION_GROUPS,
    INJURY_SEVERITY_DESCRIPTIONS,
    OPEN_INJURY_STATUS_DESCRIPTIONS,
    injuryTypeText,
    mechanismText,
    regionText,
    severityText,
} from "./clinical-copy";
import { ObservationSummary, type ObservationSource } from "./observation-summary";
import type { ProgressStep } from "@/components/medical/exam-progress";
import { ExamProgressRail } from "@/components/medical/exam-progress-rail";
import { DemoFillBar, DoctorsOnly, FormPart, useWideLayout } from "@/components/medical/form-parts";

export interface InjuryFighterOption extends FighterIdentityData {
    id: string;
}

export interface InjuryAlertOption {
    alert: AbnormalMovementAlert;
    source: ObservationSource | null;
}

export interface InjuryFormProps {
    fighters: InjuryFighterOption[];
    /** Observations of the doctor's fighters that aren't linked to another injury. */
    alerts: InjuryAlertOption[];
    defaultFighterId: string;
    defaultAlertId: string;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    cancelHref: string;
    /** Opened from the fighter's profile: the fighter is fixed and the profile header already introduces them. */
    fighterLocked?: boolean;
    /** Demo mode: offer a one-click fill with a plausible sample injury. */
    demoFill?: boolean;
}

const TYPES = Object.keys(INJURY_TYPE_LABELS) as InjuryType[];
const SEVERITIES = Object.keys(INJURY_SEVERITY_LABELS) as InjurySeverity[];
const MECHANISMS = Object.keys(INJURY_MECHANISM_LABELS) as InjuryMechanism[];
const RETURN_PICK_WEEKS = [1, 2, 4, 6];

type OpenStatus = "active" | "recovering";

/** Records an injury: who and what, where on the body, severity and timeline, clinical findings and an optional AI observation link. */
export function InjuryForm({ fighters, alerts, defaultFighterId, defaultAlertId, nowInput, today, cancelHref, fighterLocked = false, demoFill = false }: InjuryFormProps) {
    const t = useT();
    const locale = useLocale();
    const form = useActionForm(createInjuryAction, { id: "injury" });
    const id = (name: string) => `injury-${name}`;
    const severityOptions: ChoiceOption<InjurySeverity>[] = SEVERITIES.map((value) => ({
        value,
        label: severityText(t, value),
        description: t(INJURY_SEVERITY_DESCRIPTIONS[value]),
        icon: INJURY_SEVERITY_META[value].icon,
        tone: INJURY_SEVERITY_META[value].tone,
    }));
    const statusOptions: ChoiceOption<OpenStatus>[] = [
        { value: "active", label: t("doctorClinical.injuryForm.statusActive"), description: t(OPEN_INJURY_STATUS_DESCRIPTIONS.active), icon: Activity, tone: "danger" },
        { value: "recovering", label: t("doctorClinical.injuryForm.statusRecovering"), description: t(OPEN_INJURY_STATUS_DESCRIPTIONS.recovering), icon: RefreshCw, tone: "info" },
    ];
    const { error } = form;

    const initialAlert = alerts.find((option) => option.alert.id === defaultAlertId)?.alert;
    const [fighterId, setFighterId] = useState(initialAlert?.fighterId ?? defaultFighterId);
    const [linkedAlertId, setLinkedAlertId] = useState(initialAlert?.id ?? "");
    const [type, setType] = useState<InjuryType | "">("");
    const [bodyRegion, setBodyRegion] = useState<BodyRegion | "">(initialAlert?.bodyRegion ?? "");
    const [severity, setSeverity] = useState<InjurySeverity | "">("");
    const [status, setStatus] = useState<OpenStatus>("active");
    const [mechanism, setMechanism] = useState<InjuryMechanism | "">("");
    const [occurredAt, setOccurredAt] = useState(nowInput);
    const [diagnosedAt, setDiagnosedAt] = useState(today);
    const [expectedReturnAt, setExpectedReturnAt] = useState("");
    const [description, setDescription] = useState("");

    const fighterAlerts = alerts.filter((option) => option.alert.fighterId === fighterId);
    const selectedAlert = fighterAlerts.find((option) => option.alert.id === linkedAlertId) ?? null;

    const changeFighter = (next: string) => {
        setFighterId(next);
        if (!alerts.some((option) => option.alert.id === linkedAlertId && option.alert.fighterId === next)) setLinkedAlertId("");
    };

    const changeAlert = (next: string) => {
        setLinkedAlertId(next);
        const alert = alerts.find((option) => option.alert.id === next)?.alert;
        if (alert && !bodyRegion) setBodyRegion(alert.bodyRegion);
    };

    const control = (name: string, options?: { hint?: boolean; required?: boolean }) => form.control(name, options);

    const filled = (value: string) => value.trim() !== "";
    const injuryParts = [type !== "", bodyRegion !== "", severity !== ""].filter(Boolean).length;
    const timeParts = [filled(occurredAt), filled(diagnosedAt), mechanism !== ""].filter(Boolean).length;
    const state = (have: number, of: number) => (have === of ? "done" : have ? "part" : "todo") as ProgressStep["state"];
    const steps: ProgressStep[] = [
        {
            key: "injury",
            label: t("doctorClinical.common.injury"),
            pct: injuryParts / 3,
            state: state(injuryParts, 3),
            text: severity
                ? severityText(t, severity)
                : !type
                  ? t("doctorClinical.injuryForm.stepChooseType")
                  : !bodyRegion
                    ? t("doctorClinical.injuryForm.stepChooseRegion")
                    : t("doctorClinical.common.chooseSeverity"),
        },
        {
            key: "time",
            label: t("doctorClinical.injuryForm.timing"),
            pct: timeParts / 3,
            state: state(timeParts, 3),
            text:
                timeParts < 3
                    ? t("doctorClinical.injuryForm.stepChooseMechanism")
                    : expectedReturnAt
                      ? t("doctorClinical.injuryForm.stepExpected", { date: `${expectedReturnAt.slice(8, 10)}/${expectedReturnAt.slice(5, 7)}` })
                      : mechanismText(t, mechanism as InjuryMechanism),
        },
        {
            key: "clinical",
            label: t("doctorClinical.common.clinicalSigns"),
            pct: filled(description) ? 1 : 0,
            state: filled(description) ? "done" : "todo",
            text: filled(description) ? t("doctorClinical.common.described") : t("doctorClinical.injuryForm.notDescribed"),
        },
    ];

    // One 3D model only (each is a WebGL context): in the side column on wide screens, in the form otherwise.
    const wide = useWideLayout();
    const model = <RegionModel targets={[{ region: bodyRegion }]} label={type ? injuryTypeText(t, type) : t("doctorClinical.injuryForm.selectedRegion")} height={300} legend={false} />;

    /** Demo only: a plausible sample injury the doctor can still edit; "Xóa hết" empties the form again. */
    const fillSample = () => {
        setType("strain");
        setBodyRegion("right_hamstring");
        setSeverity("moderate");
        setStatus("active");
        setMechanism("sparring");
        setOccurredAt(nowInput);
        setDiagnosedAt(today);
        setExpectedReturnAt(addDaysToKey(today, 14));
        setDescription(t("doctorClinical.injuryForm.sampleDescription"));
        ["type", "bodyRegion", "severity", "mechanism", "description", "expectedReturnAt"].forEach((name) => form.markEdited(name));
    };
    const clearAll = () => {
        setType("");
        setBodyRegion("");
        setSeverity("");
        setStatus("active");
        setMechanism("");
        setExpectedReturnAt("");
        setDescription("");
    };

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {fighterLocked && <input type="hidden" name="fighterId" value={fighterId} />}
            {demoFill && (
                <DemoFillBar
                    className="xl:col-span-2"
                    title={t("doctorClinical.common.demoTitle")}
                    description={t("doctorClinical.injuryForm.demoDescription")}
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="injury-" id="injury" title={t("doctorClinical.common.injury")} description={t("doctorClinical.injuryForm.injuryPartDescription")}>
                    {!fighterLocked && (
                        <Field label={t("doctorClinical.common.fighter")} htmlFor={id("fighterId")} error={error("fighterId")} required className="sm:max-w-sm">
                            <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)}>
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
                        <Field label={t("doctorClinical.injuryForm.type")} htmlFor={id("type")} error={error("type")} required>
                            <Select {...control("type", { required: true })} value={type} onChange={(event) => setType(event.target.value as InjuryType | "")}>
                                <option value="">{t("doctorClinical.common.chooseType")}</option>
                                {TYPES.map((value) => (
                                    <option key={value} value={value}>
                                        {injuryTypeText(t, value)}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label={t("doctorClinical.injuryForm.bodyRegion")} htmlFor={id("bodyRegion")} error={error("bodyRegion")} required hint={t("doctorClinical.common.sideHint")}>
                            <Select {...control("bodyRegion", { hint: true, required: true })} value={bodyRegion} onChange={(event) => setBodyRegion(event.target.value as BodyRegion | "")}>
                                <option value="">{t("doctorClinical.injuryForm.chooseRegion")}</option>
                                {BODY_REGION_GROUPS.map((group) => (
                                    <optgroup key={group.label} label={t(group.label)}>
                                        {group.regions.map((region) => (
                                            <option key={region} value={region}>
                                                {regionText(t, region)}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    {/* Below the wide layout there is no side column, so the model sits next to the region it shows. */}
                    {!wide && <div className="rounded-lg bg-surface-muted/60 px-2 py-2">{model}</div>}

                    <ChoiceGroup
                        id={id("severity")}
                        name="severity"
                        legend={t("doctorClinical.common.severity")}
                        required
                        columns={2}
                        options={severityOptions}
                        value={severity}
                        onChange={setSeverity}
                        error={error("severity")}
                    />
                    <ChoiceGroup
                        id={id("status")}
                        name="status"
                        legend={t("doctorClinical.injuryForm.currentStatus")}
                        required
                        columns={2}
                        options={statusOptions}
                        value={status}
                        onChange={setStatus}
                        error={error("status")}
                    />
                    <Field
                        label={t("doctorClinical.injuryForm.linkAlert")}
                        htmlFor={id("linkedAlertId")}
                        optional
                        error={error("linkedAlertId")}
                        hint={
                            !fighterId
                                ? t("doctorClinical.injuryForm.linkAlertNoFighter")
                                : fighterAlerts.length === 0
                                  ? t("doctorClinical.injuryForm.linkAlertNone")
                                  : t("doctorClinical.injuryForm.linkAlertHint")
                        }
                    >
                        <Select {...control("linkedAlertId", { hint: true })} value={linkedAlertId} onChange={(event) => changeAlert(event.target.value)} disabled={fighterAlerts.length === 0}>
                            <option value="">{t("doctorClinical.injuryForm.noLink")}</option>
                            {fighterAlerts.map(({ alert }) => (
                                <option key={alert.id} value={alert.id}>
                                    {formatShortDate(alert.detectedAt, locale)} · {regionText(t, alert.bodyRegion)} — {alert.pattern}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    {selectedAlert && (
                        <div className="flex flex-col gap-3">
                            <AINotice audience="doctor" compact locale={locale === "en" ? "en" : undefined} />
                            <ObservationSummary alert={selectedAlert.alert} source={selectedAlert.source} />
                        </div>
                    )}
                </FormPart>

                <FormPart prefix="injury-" id="time" title={t("doctorClinical.injuryForm.timing")} description={t("doctorClinical.injuryForm.timingDescription")}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                        <Field label={t("doctorClinical.common.occurred")} htmlFor={id("occurredAt")} error={error("occurredAt")} required hint={t("doctorClinical.common.academyTime")}>
                            <Input {...control("occurredAt", { hint: true, required: true })} type="datetime-local" value={occurredAt} max={nowInput} onChange={(event) => setOccurredAt(event.target.value)} />
                        </Field>
                        <Field label={t("doctorClinical.common.diagnosis")} htmlFor={id("diagnosedAt")} error={error("diagnosedAt")} required>
                            <Input
                                {...control("diagnosedAt", { required: true })}
                                type="date"
                                value={diagnosedAt}
                                min={occurredAt.slice(0, 10) || undefined}
                                max={today}
                                onChange={(event) => setDiagnosedAt(event.target.value)}
                            />
                        </Field>
                        <Field label={t("doctorClinical.injuryForm.mechanism")} htmlFor={id("mechanism")} error={error("mechanism")} required>
                            <Select {...control("mechanism", { required: true })} value={mechanism} onChange={(event) => setMechanism(event.target.value as InjuryMechanism | "")}>
                                <option value="">{t("doctorClinical.injuryForm.mechanismPlaceholder")}</option>
                                {MECHANISMS.map((value) => (
                                    <option key={value} value={value}>
                                        {mechanismText(t, value)}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    <Field
                        label={t("doctorClinical.injuryForm.expectedReturn")}
                        htmlFor={id("expectedReturnAt")}
                        error={error("expectedReturnAt")}
                        optional
                        hint={
                            expectedReturnAt && diagnosedAt
                                ? t("doctorClinical.injuryForm.expectedReturnDays", { days: plural(t, "doctorClinical.count.days", daysBetweenKeys(diagnosedAt, expectedReturnAt)) })
                                : t("doctorClinical.injuryForm.expectedReturnHint")
                        }
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                {...control("expectedReturnAt", { hint: true })}
                                type="date"
                                value={expectedReturnAt}
                                min={diagnosedAt || undefined}
                                onChange={(event) => setExpectedReturnAt(event.target.value)}
                                className="sm:w-48"
                            />
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("doctorClinical.injuryForm.returnPicksLabel")}>
                                {RETURN_PICK_WEEKS.map((weeks) => {
                                    const date = diagnosedAt ? addDaysToKey(diagnosedAt, weeks * 7) : "";
                                    const chosen = Boolean(date) && expectedReturnAt === date;
                                    return (
                                        <Button
                                            key={weeks}
                                            variant={chosen ? "primary" : "secondary"}
                                            size="sm"
                                            aria-pressed={chosen}
                                            disabled={!diagnosedAt}
                                            onClick={() => {
                                                setExpectedReturnAt(date);
                                                form.markEdited("expectedReturnAt");
                                            }}
                                        >
                                            {plural(t, "doctorClinical.injuryForm.plusWeeks", weeks)}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </Field>
                </FormPart>

                <FormPart
                    prefix="injury-"
                    id="clinical"
                    title={t("doctorClinical.common.clinicalSigns")}
                    description={t("doctorClinical.injuryForm.clinicalDescription")}
                    aside={<DoctorsOnly>{t("doctorClinical.common.doctorsOnly")}</DoctorsOnly>}
                >
                    <Field label={t("doctorClinical.common.description")} htmlFor={id("description")} error={error("description")} required hint={t("doctorClinical.injuryForm.clinicalHint")}>
                        <Textarea
                            {...control("description", { hint: true, required: true })}
                            rows={4}
                            placeholder={t("doctorClinical.injuryForm.descriptionPlaceholder")}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={3000}
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
                            <Button type="submit" loading={form.pending} className="w-full">
                                {form.pending ? t("doctorClinical.common.recordingInjury") : t("doctorClinical.common.recordInjury")}
                            </Button>
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

