"use client";

import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, FormSection, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { updateSettingsAction } from "@/lib/actions/admin";
import type { SystemSettings } from "@/lib/domain/types";
import { ThresholdBands } from "./threshold-bands";

interface FormValues {
    organizationName: string;
    sessionTimeoutMin: string;
    requireMfa: boolean;
    videoMaxSizeMb: string;
    videoRetentionDays: string;
    allowedVideoFormats: string[];
    aiConfidenceThreshold: string;
    aiLowConfidenceThreshold: string;
    abnormalMovementAlertsEnabled: boolean;
    notifyDoctorOnAlert: boolean;
    clearanceExpiryWarningDays: string;
}

type FieldName = keyof FormValues;

const FIELD_NAMES: FieldName[] = [
    "organizationName",
    "sessionTimeoutMin",
    "requireMfa",
    "videoMaxSizeMb",
    "videoRetentionDays",
    "allowedVideoFormats",
    "aiConfidenceThreshold",
    "aiLowConfidenceThreshold",
    "abnormalMovementAlertsEnabled",
    "notifyDoctorOnAlert",
    "clearanceExpiryWarningDays",
];

const SECTIONS: { id: string; title: string; fields: FieldName[] }[] = [
    { id: "organization", title: "Organization", fields: ["organizationName"] },
    { id: "security", title: "Security", fields: ["sessionTimeoutMin", "requireMfa"] },
    { id: "video", title: "Video storage", fields: ["videoMaxSizeMb", "videoRetentionDays", "allowedVideoFormats"] },
    { id: "ai", title: "AI analysis", fields: ["aiConfidenceThreshold", "aiLowConfidenceThreshold", "abnormalMovementAlertsEnabled", "notifyDoctorOnAlert"] },
    { id: "medical", title: "Medical", fields: ["clearanceExpiryWarningDays"] },
];

function toFormValues(settings: SystemSettings): FormValues {
    return {
        organizationName: settings.organizationName,
        sessionTimeoutMin: String(settings.sessionTimeoutMin),
        requireMfa: settings.requireMfa,
        videoMaxSizeMb: String(settings.videoMaxSizeMb),
        videoRetentionDays: String(settings.videoRetentionDays),
        allowedVideoFormats: [...settings.allowedVideoFormats].sort(),
        aiConfidenceThreshold: String(Math.round(settings.aiConfidenceThreshold * 100)),
        aiLowConfidenceThreshold: String(Math.round(settings.aiLowConfidenceThreshold * 100)),
        abnormalMovementAlertsEnabled: settings.abnormalMovementAlertsEnabled,
        notifyDoctorOnAlert: settings.notifyDoctorOnAlert,
        clearanceExpiryWarningDays: String(settings.clearanceExpiryWarningDays),
    };
}

const same = (a: FormValues[FieldName], b: FormValues[FieldName]) => JSON.stringify(a) === JSON.stringify(b);

export interface SettingsFormProps {
    settings: SystemSettings;
    /** Video container formats an administrator can allow. */
    formatOptions: string[];
}

/** System settings in sections with a sticky save bar, dirty-state tracking and inline server errors. */
export function SettingsForm({ settings, formatOptions }: SettingsFormProps) {
    const toast = useToast();
    const baseline = toFormValues(settings);
    const [values, setValues] = useState<FormValues>(baseline);

    const form = useActionForm(updateSettingsAction, {
        id: "settings",
        onSuccess: (state) => {
            if (state.data) setValues(toFormValues(state.data));
            toast({ title: "System settings saved", description: "Changes apply to everyone straight away." });
        },
    });
    const { error, markEdited } = form;
    const set = <K extends FieldName>(key: K, value: FormValues[K]) => {
        setValues((current) => ({ ...current, [key]: value }));
        markEdited(key);
    };
    const discard = () => {
        setValues(baseline);
        FIELD_NAMES.forEach(markEdited);
    };
    const dirtySections = SECTIONS.filter((section) => section.fields.some((field) => !same(values[field], baseline[field])));
    const dirty = dirtySections.length > 0;
    const modified = (id: string) => dirtySections.some((section) => section.id === id);

    const conf = Number(values.aiConfidenceThreshold);
    const low = Number(values.aiLowConfidenceThreshold);
    const thresholdsPreviewable = Number.isInteger(conf) && Number.isInteger(low) && values.aiConfidenceThreshold !== "" && values.aiLowConfidenceThreshold !== "" && conf < low;

    const toggleFormat = (format: string, checked: boolean) =>
        set("allowedVideoFormats", checked ? [...values.allowedVideoFormats, format].sort() : values.allowedVideoFormats.filter((f) => f !== format));

    return (
        <form {...form.formProps} className="flex flex-col">
            <div className="px-5 py-6">
                <FormSection title="Organization" description={<SectionHint modified={modified("organization")}>How the academy appears across the platform.</SectionHint>}>
                    <Field label="Organization name" htmlFor="settings-org" required error={error("organizationName")}>
                        <Input
                            id="settings-org"
                            name="organizationName"
                            required
                            value={values.organizationName}
                            onChange={(event) => set("organizationName", event.target.value)}
                            className="sm:max-w-md"
                        />
                    </Field>
                    <Field label="Timezone" htmlFor="settings-timezone" hint="Set at deployment. All dates, schedules and reports use this timezone.">
                        <Input id="settings-timezone" value={settings.timezone} readOnly disabled className="sm:max-w-xs" />
                    </Field>
                </FormSection>

                <FormSection title="Security" description={<SectionHint modified={modified("security")}>Sign-in rules for every account.</SectionHint>}>
                    <NumberField
                        id="settings-timeout"
                        name="sessionTimeoutMin"
                        label="Session timeout"
                        unit="min"
                        min={15}
                        max={1440}
                        value={values.sessionTimeoutMin}
                        onChange={(value) => set("sessionTimeoutMin", value)}
                        hint="People are signed out after this much inactivity (15–1440 minutes)."
                        error={error("sessionTimeoutMin")}
                    />
                    <Switch
                        id="settings-mfa"
                        checked={values.requireMfa}
                        disabled
                        label="Require multi-factor authentication"
                        description="Available when the authentication service is connected."
                    />
                    {values.requireMfa && <input type="hidden" name="requireMfa" value="on" />}
                </FormSection>

                <FormSection title="Video storage" description={<SectionHint modified={modified("video")}>Upload limits and how long footage is kept.</SectionHint>}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                            id="settings-max-size"
                            name="videoMaxSizeMb"
                            label="Maximum upload size"
                            unit="MB"
                            min={50}
                            max={4096}
                            value={values.videoMaxSizeMb}
                            onChange={(value) => set("videoMaxSizeMb", value)}
                            hint="Per video, between 50 and 4096 MB."
                            error={error("videoMaxSizeMb")}
                        />
                        <NumberField
                            id="settings-retention"
                            name="videoRetentionDays"
                            label="Retention period"
                            unit="days"
                            min={30}
                            max={3650}
                            value={values.videoRetentionDays}
                            onChange={(value) => set("videoRetentionDays", value)}
                            hint="Older footage is removed with its analysis (30–3650 days)."
                            error={error("videoRetentionDays")}
                        />
                    </div>
                    <fieldset
                        data-invalid={error("allowedVideoFormats") ? "true" : undefined}
                        aria-describedby={error("allowedVideoFormats") ? "settings-formats-error" : "settings-formats-hint"}
                    >
                        <legend className="mb-2 text-sm font-medium text-fg">
                            Allowed formats
                            <span className="ml-0.5 text-danger-fg" aria-hidden>
                                *
                            </span>
                            <span className="sr-only"> (required)</span>
                        </legend>
                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                            {formatOptions.map((format) => (
                                <Checkbox
                                    key={format}
                                    id={`settings-format-${format}`}
                                    name="allowedVideoFormats"
                                    value={format}
                                    checked={values.allowedVideoFormats.includes(format)}
                                    onChange={(event) => toggleFormat(format, event.target.checked)}
                                    aria-required
                                    aria-invalid={error("allowedVideoFormats") ? true : undefined}
                                    label={<span className="font-mono uppercase">{format}</span>}
                                />
                            ))}
                        </div>
                        {error("allowedVideoFormats") ? (
                            <p id="settings-formats-error" className="mt-2 text-[13px] font-medium text-danger-fg">
                                {error("allowedVideoFormats")}
                            </p>
                        ) : (
                            <p id="settings-formats-hint" className="mt-2 text-[13px] text-fg-subtle">
                                Uploads in other formats are rejected before they start.
                            </p>
                        )}
                    </fieldset>
                </FormSection>

                <FormSection title="AI analysis" description={<SectionHint modified={modified("ai")}>Platform-wide confidence rules and movement observations.</SectionHint>}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                            id="settings-ai-confidence"
                            name="aiConfidenceThreshold"
                            label="Detection threshold"
                            unit="%"
                            min={5}
                            max={95}
                            value={values.aiConfidenceThreshold}
                            onChange={(value) => set("aiConfidenceThreshold", value)}
                            hint="Model outputs below this percentage are discarded."
                            error={error("aiConfidenceThreshold")}
                        />
                        <NumberField
                            id="settings-ai-low"
                            name="aiLowConfidenceThreshold"
                            label="Low-confidence review threshold"
                            unit="%"
                            min={5}
                            max={95}
                            value={values.aiLowConfidenceThreshold}
                            onChange={(value) => set("aiLowConfidenceThreshold", value)}
                            hint="Results below this percentage are flagged “Needs review” for coaches."
                            error={error("aiLowConfidenceThreshold")}
                        />
                    </div>
                    {thresholdsPreviewable && <ThresholdBands confidencePct={conf} lowConfidencePct={low} />}
                    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                        <div>
                            <Switch
                                id="settings-alerts"
                                name="abnormalMovementAlertsEnabled"
                                checked={values.abnormalMovementAlertsEnabled}
                                onChange={(event) => set("abnormalMovementAlertsEnabled", event.target.checked)}
                                label="AI movement observations"
                                description="Flag possible abnormal movement in analysed footage for sports doctors to review. Supporting information only — never a diagnosis."
                            />
                            <div aria-live="polite">
                                {!values.abnormalMovementAlertsEnabled && baseline.abnormalMovementAlertsEnabled && (
                                    <InlineNote icon={TriangleAlert} tone="warning" className="mt-3">
                                        Doctors are told that observations are paused. Existing observations stay as they are.
                                    </InlineNote>
                                )}
                            </div>
                        </div>
                        <Switch
                            id="settings-notify-doctor"
                            name={values.abnormalMovementAlertsEnabled ? "notifyDoctorOnAlert" : undefined}
                            checked={values.notifyDoctorOnAlert}
                            disabled={!values.abnormalMovementAlertsEnabled}
                            onChange={(event) => set("notifyDoctorOnAlert", event.target.checked)}
                            label="Notify the assigned doctor"
                            description={
                                values.abnormalMovementAlertsEnabled
                                    ? "Send an in-app notification when a new observation is raised."
                                    : "Available when movement observations are on."
                            }
                        />
                        {!values.abnormalMovementAlertsEnabled && values.notifyDoctorOnAlert && <input type="hidden" name="notifyDoctorOnAlert" value="on" />}
                    </div>
                </FormSection>

                <FormSection title="Medical" description={<SectionHint modified={modified("medical")}>Reminders about Medical Clearance.</SectionHint>}>
                    <NumberField
                        id="settings-clearance-warning"
                        name="clearanceExpiryWarningDays"
                        label="Clearance expiry warning"
                        unit="days"
                        min={1}
                        max={90}
                        value={values.clearanceExpiryWarningDays}
                        onChange={(value) => set("clearanceExpiryWarningDays", value)}
                        hint="Coaches and doctors are warned this many days before a clearance expires (1–90 days)."
                        error={error("clearanceExpiryWarningDays")}
                    />
                </FormSection>
            </div>

            <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-border bg-surface/95 px-5 py-3 backdrop-blur md:bottom-0">
                <div aria-live="polite" className="min-w-0 text-[13px]">
                    {form.message.status === "error" ? (
                        <FormMessage {...form.message} />
                    ) : dirty ? (
                        <p className="flex items-center gap-2 font-medium text-warning-fg">
                            <span aria-hidden className="size-2 rounded-full bg-warning-solid" />
                            Unsaved changes in {dirtySections.map((section) => section.title).join(", ")}
                        </p>
                    ) : (
                        <p className="text-fg-subtle">All changes saved</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" disabled={!dirty} onClick={discard}>
                        Discard
                    </Button>
                    <SubmitButton pending={form.pending} pendingLabel="Saving…" disabled={!dirty}>
                        Save changes
                    </SubmitButton>
                </div>
            </div>
        </form>
    );
}

function SectionHint({ modified, children }: { modified: boolean; children: ReactNode }) {
    return (
        <>
            {children}
            {modified && (
                <Badge tone="warning" size="sm" className="mt-2 flex w-fit">
                    Modified
                </Badge>
            )}
        </>
    );
}

function NumberField({
    id,
    name,
    label,
    unit,
    min,
    max,
    value,
    onChange,
    hint,
    error,
}: {
    id: string;
    name: FieldName;
    label: string;
    unit: string;
    min: number;
    max: number;
    value: string;
    onChange: (value: string) => void;
    hint: string;
    error?: string;
}) {
    return (
        <Field label={label} htmlFor={id} required hint={hint} error={error}>
            <div className="sm:max-w-48">
                <Input
                    id={id}
                    name={name}
                    type="number"
                    inputMode="numeric"
                    required
                    min={min}
                    max={max}
                    step={1}
                    suffix={unit}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="tabular-nums"
                />
            </div>
        </Field>
    );
}
