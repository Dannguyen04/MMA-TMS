"use client";

import { Activity, Info, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AINotice } from "@/components/domain/ai-notice";
import { BodyMap } from "@/components/domain/body-map";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createInjuryAction } from "@/lib/actions/clinical";
import { BODY_REGION_LABELS, HEALTH_STATUS_LABELS, INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { AbnormalMovementAlert, BodyRegion, InjuryMechanism, InjurySeverity, InjuryType } from "@/lib/domain/types";
import { addDaysToKey, daysBetweenKeys, formatShortDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BODY_REGION_GROUPS, INJURY_SEVERITY_DESCRIPTIONS, OPEN_INJURY_STATUS_DESCRIPTIONS } from "./clinical-copy";
import { ObservationSummary, type ObservationSource } from "./observation-summary";

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
}

const TYPES = Object.keys(INJURY_TYPE_LABELS) as InjuryType[];
const SEVERITY_OPTIONS: ChoiceOption<InjurySeverity>[] = (Object.keys(INJURY_SEVERITY_LABELS) as InjurySeverity[]).map((value) => ({
    value,
    label: INJURY_SEVERITY_LABELS[value],
    description: INJURY_SEVERITY_DESCRIPTIONS[value],
    icon: INJURY_SEVERITY_META[value].icon,
    tone: INJURY_SEVERITY_META[value].tone,
}));
const MECHANISMS = Object.keys(INJURY_MECHANISM_LABELS) as InjuryMechanism[];
const RETURN_PICKS = [
    { days: 7, label: "+1 week" },
    { days: 14, label: "+2 weeks" },
    { days: 28, label: "+4 weeks" },
    { days: 42, label: "+6 weeks" },
];

type OpenStatus = "active" | "recovering";

const STATUS_OPTIONS: ChoiceOption<OpenStatus>[] = [
    { value: "active", label: "Active", description: OPEN_INJURY_STATUS_DESCRIPTIONS.active, icon: Activity, tone: "danger" },
    { value: "recovering", label: "Recovering", description: OPEN_INJURY_STATUS_DESCRIPTIONS.recovering, icon: RefreshCw, tone: "info" },
];

/** Records an injury: who and what, where on the body, severity and timeline, clinical findings and an optional AI observation link. */
export function InjuryForm({ fighters, alerts, defaultFighterId, defaultAlertId, nowInput, today, cancelHref }: InjuryFormProps) {
    const form = useActionForm(createInjuryAction, { id: "injury" });
    const id = (name: string) => `injury-${name}`;
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

    const fighter = fighters.find((option) => option.id === fighterId) ?? null;
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

    return (
        <form
            {...form.formProps}
            className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]"
        >
            {selectedAlert && (
                <section aria-labelledby="injury-context-heading" className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1">
                    <h2 id="injury-context-heading" className="text-sm font-semibold text-fg">
                        Linked observation
                    </h2>
                    <AINotice audience="doctor" compact />
                    <ObservationSummary alert={selectedAlert.alert} source={selectedAlert.source} />
                </section>
            )}

            <Card className="min-w-0 px-5 py-6 sm:px-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
                <FormSection title="Fighter" description="Who was injured. Link an AI movement observation if one prompted this assessment.">
                    <Field label="Fighter" htmlFor={id("fighterId")} error={error("fighterId")} required>
                        <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)} className="sm:max-w-sm">
                            <option value="">Choose a fighter…</option>
                            {fighters.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field
                        label="Link AI movement observation"
                        htmlFor={id("linkedAlertId")}
                        optional
                        error={error("linkedAlertId")}
                        hint={
                            !fighterId
                                ? "Choose a fighter first."
                                : fighterAlerts.length === 0
                                  ? "No unlinked AI movement observations for this fighter."
                                  : "Supporting information only. The link helps review the AI model against confirmed injuries."
                        }
                    >
                        <Select
                            {...control("linkedAlertId", { hint: true })}
                            value={linkedAlertId}
                            onChange={(event) => changeAlert(event.target.value)}
                            disabled={fighterAlerts.length === 0}
                        >
                            <option value="">Not linked</option>
                            {fighterAlerts.map(({ alert }) => (
                                <option key={alert.id} value={alert.id}>
                                    {formatShortDate(alert.detectedAt)} · {BODY_REGION_LABELS[alert.bodyRegion]} — {alert.pattern}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                <FormSection title="Injury" description="What the injury is, where it is and how serious it is.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 flex-col gap-5">
                            <Field label="Injury type" htmlFor={id("type")} error={error("type")} required>
                                <Select {...control("type", { required: true })} value={type} onChange={(event) => setType(event.target.value as InjuryType | "")}>
                                    <option value="">Choose a type…</option>
                                    {TYPES.map((value) => (
                                        <option key={value} value={value}>
                                            {INJURY_TYPE_LABELS[value]}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field
                                label="Body region"
                                htmlFor={id("bodyRegion")}
                                error={error("bodyRegion")}
                                required
                                hint="Left and right are the athlete's own sides."
                            >
                                <Select
                                    {...control("bodyRegion", { hint: true, required: true })}
                                    value={bodyRegion}
                                    onChange={(event) => setBodyRegion(event.target.value as BodyRegion | "")}
                                >
                                    <option value="">Choose a region…</option>
                                    {BODY_REGION_GROUPS.map((group) => (
                                        <optgroup key={group.label} label={group.label}>
                                            {group.regions.map((region) => (
                                                <option key={region} value={region}>
                                                    {BODY_REGION_LABELS[region]}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </Select>
                            </Field>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 rounded-lg bg-surface-muted/60 px-4 py-3" aria-live="polite">
                            <BodyMap
                                size="sm"
                                showLegend={false}
                                highlights={
                                    bodyRegion
                                        ? [
                                              {
                                                  region: bodyRegion,
                                                  tone: severity && INJURY_SEVERITY_META[severity].tone === "warning" ? "warning" : "danger",
                                                  label: type ? INJURY_TYPE_LABELS[type] : "Selected region",
                                              },
                                          ]
                                        : []
                                }
                            />
                            <p className="text-center text-xs font-medium text-fg-muted">
                                {bodyRegion ? BODY_REGION_LABELS[bodyRegion] : "No region selected"}
                            </p>
                        </div>
                    </div>

                    <ChoiceGroup
                        id={id("severity")}
                        name="severity"
                        legend="Severity"
                        required
                        options={SEVERITY_OPTIONS}
                        value={severity}
                        onChange={setSeverity}
                        error={error("severity")}
                    />

                    <ChoiceGroup
                        id={id("status")}
                        name="status"
                        legend="Current status"
                        required
                        columns={2}
                        options={STATUS_OPTIONS}
                        value={status}
                        onChange={setStatus}
                        error={error("status")}
                    />
                </FormSection>

                <FormSection title="Timeline" description="When and how it happened, and when you expect the fighter back in full training.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Occurred" htmlFor={id("occurredAt")} error={error("occurredAt")} required hint="Academy time (Ho Chi Minh City)">
                            <Input
                                {...control("occurredAt", { hint: true, required: true })}
                                type="datetime-local"
                                value={occurredAt}
                                max={nowInput}
                                onChange={(event) => setOccurredAt(event.target.value)}
                            />
                        </Field>
                        <Field label="Diagnosed" htmlFor={id("diagnosedAt")} error={error("diagnosedAt")} required>
                            <Input
                                {...control("diagnosedAt", { required: true })}
                                type="date"
                                value={diagnosedAt}
                                min={occurredAt.slice(0, 10) || undefined}
                                max={today}
                                onChange={(event) => setDiagnosedAt(event.target.value)}
                            />
                        </Field>
                        <Field label="Mechanism" htmlFor={id("mechanism")} error={error("mechanism")} required>
                            <Select {...control("mechanism", { required: true })} value={mechanism} onChange={(event) => setMechanism(event.target.value as InjuryMechanism | "")}>
                                <option value="">How did it happen?</option>
                                {MECHANISMS.map((value) => (
                                    <option key={value} value={value}>
                                        {INJURY_MECHANISM_LABELS[value]}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field
                            label="Expected return to full training"
                            htmlFor={id("expectedReturnAt")}
                            error={error("expectedReturnAt")}
                            className="sm:col-span-2"
                            optional
                            hint={
                                expectedReturnAt && diagnosedAt
                                    ? `${pluralize(daysBetweenKeys(diagnosedAt, expectedReturnAt), "day")} after diagnosis`
                                    : "Leave empty if it can't be estimated yet."
                            }
                        >
                            <div className="flex flex-col gap-2">
                                <Input
                                    {...control("expectedReturnAt", { hint: true })}
                                    type="date"
                                    value={expectedReturnAt}
                                    min={diagnosedAt || undefined}
                                    onChange={(event) => setExpectedReturnAt(event.target.value)}
                                    className="sm:w-56"
                                />
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Set expected return from the diagnosis date">
                                    {RETURN_PICKS.map((pick) => (
                                        <Button
                                            key={pick.days}
                                            variant="secondary"
                                            size="sm"
                                            disabled={!diagnosedAt}
                                            onClick={() => {
                                                setExpectedReturnAt(addDaysToKey(diagnosedAt, pick.days));
                                                form.markEdited("expectedReturnAt");
                                            }}
                                        >
                                            {pick.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </Field>
                    </div>
                </FormSection>

                <FormSection title="Clinical findings" description="Visible to you and other assigned doctors. Coaches never see clinical notes.">
                    <Field
                        label="Description"
                        htmlFor={id("description")}
                        error={error("description")}
                        required
                        hint="Mechanism, symptoms, examination findings and any imaging results."
                    >
                        <Textarea
                            {...control("description", { hint: true, required: true })}
                            rows={5}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={3000}
                        />
                    </Field>
                </FormSection>

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <FormMessage {...form.message} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <ButtonLink href={cancelHref} variant="secondary" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            Cancel
                        </ButtonLink>
                        <Button type="submit" size="lg" loading={form.pending} className="sm:h-9 sm:px-3.5 sm:text-sm">
                            {form.pending ? "Recording injury…" : "Record injury"}
                        </Button>
                    </div>
                </div>
            </Card>

            <aside aria-label="What happens next" className={cn("min-w-0 lg:col-start-2", selectedAlert ? "lg:row-start-2" : "lg:row-start-1")}>
                <Card>
                    <CardHeader title="When you record this injury" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span>
                                    {fighter
                                        ? fighter.healthStatus === "not_cleared"
                                            ? `${fighter.name} stays ${HEALTH_STATUS_LABELS.not_cleared}.`
                                            : `${fighter.name}'s health status changes to ${status === "recovering" ? HEALTH_STATUS_LABELS.recovery : HEALTH_STATUS_LABELS.injured}.`
                                        : "The fighter's health status changes to Injured, or Recovery if recorded as recovering."}
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span>Coaches are asked to check Medical Clearance. They don&apos;t see the diagnosis or clinical notes.</span>
                            </li>
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span>The fighter sees the injury, treatments and recovery steps on their Health page.</span>
                            </li>
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span className="font-medium text-fg">Medical Clearance doesn&apos;t change automatically — review it next.</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
