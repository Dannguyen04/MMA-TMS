"use client";

import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, FormSection, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { updateSettingsAction } from "@/lib/actions/admin";
import type { SystemSettings } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n/translate";
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

const SECTIONS: { id: string; title: MessageKey; fields: FieldName[] }[] = [
    { id: "organization", title: "adminForms.org", fields: ["organizationName"] },
    { id: "security", title: "adminForms.security", fields: ["sessionTimeoutMin", "requireMfa"] },
    { id: "video", title: "adminForms.video", fields: ["videoMaxSizeMb", "videoRetentionDays", "allowedVideoFormats"] },
    { id: "ai", title: "adminForms.ai", fields: ["aiConfidenceThreshold", "aiLowConfidenceThreshold", "abnormalMovementAlertsEnabled", "notifyDoctorOnAlert"] },
    { id: "medical", title: "adminForms.medical", fields: ["clearanceExpiryWarningDays"] },
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
    /** Shows the settings without a way to save them, while the settings service isn't available. */
    readOnly?: boolean;
}

/** System settings in sections with a sticky save bar, dirty-state tracking and inline server errors. */
export function SettingsForm({ settings, formatOptions, readOnly = false }: SettingsFormProps) {
    const t = useT();
    const toast = useToast();
    const baseline = toFormValues(settings);
    const [values, setValues] = useState<FormValues>(baseline);

    const form = useActionForm(updateSettingsAction, {
        id: "settings",
        onSuccess: (state) => {
            if (state.data) setValues(toFormValues(state.data));
            toast({ title: t("adminForms.settingsSaved"), description: t("adminForms.settingsSavedText") });
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
            <fieldset disabled={readOnly} className="min-w-0 px-5 py-6">
                <FormSection title={t("adminForms.org")} description={<SectionHint modified={modified("organization")}>{t("adminForms.orgDesc")}</SectionHint>}>
                    <Field label={t("adminForms.orgName")} htmlFor="settings-org" required error={error("organizationName")}>
                        <Input
                            id="settings-org"
                            name="organizationName"
                            required
                            value={values.organizationName}
                            onChange={(event) => set("organizationName", event.target.value)}
                            className="sm:max-w-md"
                        />
                    </Field>
                    <Field label={t("adminForms.timezone")} htmlFor="settings-timezone" hint={t("adminForms.timezoneHint")}>
                        <Input id="settings-timezone" value={settings.timezone} readOnly disabled className="sm:max-w-xs" />
                    </Field>
                </FormSection>

                <FormSection title={t("adminForms.security")} description={<SectionHint modified={modified("security")}>{t("adminForms.securityDesc")}</SectionHint>}>
                    <NumberField
                        id="settings-timeout"
                        name="sessionTimeoutMin"
                        label={t("adminForms.timeout")}
                        unit={t("adminForms.min")}
                        min={15}
                        max={1440}
                        value={values.sessionTimeoutMin}
                        onChange={(value) => set("sessionTimeoutMin", value)}
                        hint={t("adminForms.timeoutHint")}
                        error={error("sessionTimeoutMin")}
                    />
                    <Switch
                        id="settings-mfa"
                        checked={values.requireMfa}
                        disabled
                        label={t("adminForms.mfa")}
                        description={t("adminForms.mfaDesc")}
                    />
                    {values.requireMfa && <input type="hidden" name="requireMfa" value="on" />}
                </FormSection>

                <FormSection title={t("adminForms.video")} description={<SectionHint modified={modified("video")}>{t("adminForms.videoDesc")}</SectionHint>}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                            id="settings-max-size"
                            name="videoMaxSizeMb"
                            label={t("adminForms.maxSize")}
                            unit="MB"
                            min={50}
                            max={4096}
                            value={values.videoMaxSizeMb}
                            onChange={(value) => set("videoMaxSizeMb", value)}
                            hint={t("adminForms.maxSizeHint")}
                            error={error("videoMaxSizeMb")}
                        />
                        <NumberField
                            id="settings-retention"
                            name="videoRetentionDays"
                            label={t("adminForms.retention")}
                            unit={t("adminForms.days")}
                            min={30}
                            max={3650}
                            value={values.videoRetentionDays}
                            onChange={(value) => set("videoRetentionDays", value)}
                            hint={t("adminForms.retentionHint")}
                            error={error("videoRetentionDays")}
                        />
                    </div>
                    <fieldset
                        data-invalid={error("allowedVideoFormats") ? "true" : undefined}
                        aria-describedby={error("allowedVideoFormats") ? "settings-formats-error" : "settings-formats-hint"}
                    >
                        <legend className="mb-2 text-sm font-medium text-fg">
                            {t("adminForms.formats")}
                            <span className="ml-0.5 text-danger-fg" aria-hidden>
                                *
                            </span>
                            <span className="sr-only"> {t("adminForms.required")}</span>
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
                                {t("adminForms.formatsHint")}
                            </p>
                        )}
                    </fieldset>
                </FormSection>

                <FormSection title={t("adminForms.ai")} description={<SectionHint modified={modified("ai")}>{t("adminForms.aiDesc")}</SectionHint>}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                            id="settings-ai-confidence"
                            name="aiConfidenceThreshold"
                            label={t("adminForms.detect")}
                            unit="%"
                            min={5}
                            max={95}
                            value={values.aiConfidenceThreshold}
                            onChange={(value) => set("aiConfidenceThreshold", value)}
                            hint={t("adminForms.detectHint")}
                            error={error("aiConfidenceThreshold")}
                        />
                        <NumberField
                            id="settings-ai-low"
                            name="aiLowConfidenceThreshold"
                            label={t("adminForms.lowReview")}
                            unit="%"
                            min={5}
                            max={95}
                            value={values.aiLowConfidenceThreshold}
                            onChange={(value) => set("aiLowConfidenceThreshold", value)}
                            hint={t("adminForms.lowReviewHint")}
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
                                label={t("adminForms.observations")}
                                description={t("adminForms.observationsDesc")}
                            />
                            <div aria-live="polite">
                                {!values.abnormalMovementAlertsEnabled && baseline.abnormalMovementAlertsEnabled && (
                                    <InlineNote icon={TriangleAlert} tone="warning" className="mt-3">
                                        {t("adminForms.paused")}
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
                            label={t("adminForms.notifyDoctor")}
                            description={values.abnormalMovementAlertsEnabled ? t("adminForms.notifyOn") : t("adminForms.notifyOff")}
                        />
                        {!values.abnormalMovementAlertsEnabled && values.notifyDoctorOnAlert && <input type="hidden" name="notifyDoctorOnAlert" value="on" />}
                    </div>
                </FormSection>

                <FormSection title={t("adminForms.medical")} description={<SectionHint modified={modified("medical")}>{t("adminForms.medicalDesc")}</SectionHint>}>
                    <NumberField
                        id="settings-clearance-warning"
                        name="clearanceExpiryWarningDays"
                        label={t("adminForms.clearance")}
                        unit={t("adminForms.days")}
                        min={1}
                        max={90}
                        value={values.clearanceExpiryWarningDays}
                        onChange={(value) => set("clearanceExpiryWarningDays", value)}
                        hint={t("adminForms.clearanceHint")}
                        error={error("clearanceExpiryWarningDays")}
                    />
                </FormSection>
            </fieldset>

            {!readOnly && (
                <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-border bg-surface/95 px-5 py-3 backdrop-blur md:bottom-0">
                    <div aria-live="polite" className="min-w-0 text-[13px]">
                        {form.message.status === "error" ? (
                            <FormMessage {...form.message} />
                        ) : dirty ? (
                            <p className="flex items-center gap-2 font-medium text-warning-fg">
                                <span aria-hidden className="size-2 rounded-full bg-warning-solid" />
                                {t("adminForms.unsavedIn", { sections: dirtySections.map((section) => t(section.title)).join(", ") })}
                            </p>
                        ) : (
                            <p className="text-fg-subtle">{t("adminForms.allSaved")}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" disabled={!dirty} onClick={discard}>
                            {t("adminForms.discard")}
                        </Button>
                        <SubmitButton pending={form.pending} pendingLabel={t("adminForms.saving")} disabled={!dirty}>
                            {t("adminForms.save")}
                        </SubmitButton>
                    </div>
                </div>
            )}
        </form>
    );
}

function SectionHint({ modified, children }: { modified: boolean; children: ReactNode }) {
    const t = useT();
    return (
        <>
            {children}
            {modified && (
                <Badge tone="warning" size="sm" className="mt-2 flex w-fit">
                    {t("adminForms.modified")}
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
