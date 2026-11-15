"use client";

import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useLocale, useT } from "@/components/i18n/locale-provider";
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

const SECTIONS: { id: "organization" | "security" | "video" | "ai" | "medical"; fields: FieldName[] }[] = [
    { id: "organization", fields: ["organizationName"] },
    { id: "security", fields: ["sessionTimeoutMin", "requireMfa"] },
    { id: "video", fields: ["videoMaxSizeMb", "videoRetentionDays", "allowedVideoFormats"] },
    { id: "ai", fields: ["aiConfidenceThreshold", "aiLowConfidenceThreshold", "abnormalMovementAlertsEnabled", "notifyDoctorOnAlert"] },
    { id: "medical", fields: ["clearanceExpiryWarningDays"] },
];

const sectionTitleKey = (id: (typeof SECTIONS)[number]["id"]) => `screens.admin.settings.section.${id}` as MessageKey;

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
    const locale = useLocale();
    const toast = useToast();
    const baseline = toFormValues(settings);
    const [values, setValues] = useState<FormValues>(baseline);

    const form = useActionForm(updateSettingsAction, {
        id: "settings",
        onSuccess: (state) => {
            if (state.data) setValues(toFormValues(state.data));
            toast({ title: t("screens.admin.settings.savedTitle"), description: t("screens.admin.settings.savedDescription") });
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
                <FormSection
                    title={t(sectionTitleKey("organization"))}
                    description={<SectionHint modified={modified("organization")}>{t("screens.admin.settings.organizationHint")}</SectionHint>}
                >
                    <Field label={t("screens.admin.settings.organizationName")} htmlFor="settings-org" required error={error("organizationName")}>
                        <Input
                            id="settings-org"
                            name="organizationName"
                            required
                            value={values.organizationName}
                            onChange={(event) => set("organizationName", event.target.value)}
                            className="sm:max-w-md"
                        />
                    </Field>
                    <Field label={t("screens.admin.settings.timezone")} htmlFor="settings-timezone" hint={t("screens.admin.settings.timezoneHint")}>
                        <Input id="settings-timezone" value={settings.timezone} readOnly disabled className="sm:max-w-xs" />
                    </Field>
                </FormSection>

                <FormSection
                    title={t(sectionTitleKey("security"))}
                    description={<SectionHint modified={modified("security")}>{t("screens.admin.settings.securityHint")}</SectionHint>}
                >
                    <NumberField
                        id="settings-timeout"
                        name="sessionTimeoutMin"
                        label={t("screens.admin.settings.sessionTimeout")}
                        unit={t("screens.admin.settings.unitMinutes")}
                        min={15}
                        max={1440}
                        value={values.sessionTimeoutMin}
                        onChange={(value) => set("sessionTimeoutMin", value)}
                        hint={t("screens.admin.settings.sessionTimeoutHint")}
                        error={error("sessionTimeoutMin")}
                    />
                    <Switch id="settings-mfa" checked={values.requireMfa} disabled label={t("screens.admin.settings.mfa")} description={t("screens.admin.settings.mfaHint")} />
                    {values.requireMfa && <input type="hidden" name="requireMfa" value="on" />}
                </FormSection>

                <FormSection title={t(sectionTitleKey("video"))} description={<SectionHint modified={modified("video")}>{t("screens.admin.settings.videoHint")}</SectionHint>}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                            id="settings-max-size"
                            name="videoMaxSizeMb"
                            label={t("screens.admin.settings.maxSize")}
                            unit="MB"
                            min={50}
                            max={4096}
                            value={values.videoMaxSizeMb}
                            onChange={(value) => set("videoMaxSizeMb", value)}
                            hint={t("screens.admin.settings.maxSizeHint")}
                            error={error("videoMaxSizeMb")}
                        />
                        <NumberField
                            id="settings-retention"
                            name="videoRetentionDays"
                            label={t("screens.admin.settings.retention")}
                            unit={t("screens.admin.settings.unitDays")}
                            min={30}
                            max={3650}
                            value={values.videoRetentionDays}
                            onChange={(value) => set("videoRetentionDays", value)}
                            hint={t("screens.admin.settings.retentionHint")}
                            error={error("videoRetentionDays")}
                        />
                    </div>
                    <fieldset
                        data-invalid={error("allowedVideoFormats") ? "true" : undefined}
                        aria-describedby={error("allowedVideoFormats") ? "settings-formats-error" : "settings-formats-hint"}
                    >
                        <legend className="mb-2 text-sm font-medium text-fg">
                            {t("screens.admin.settings.formats")}
                            <span className="ml-0.5 text-danger-fg" aria-hidden>
                                *
                            </span>
                            <span className="sr-only"> {t("screens.admin.common.required")}</span>
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
                                {t("screens.admin.settings.formatsHint")}
                            </p>
                        )}
                    </fieldset>
                </FormSection>

                <FormSection title={t(sectionTitleKey("ai"))} description={<SectionHint modified={modified("ai")}>{t("screens.admin.settings.aiHint")}</SectionHint>}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <NumberField
                            id="settings-ai-confidence"
                            name="aiConfidenceThreshold"
                            label={t("screens.admin.settings.detection")}
                            unit="%"
                            min={5}
                            max={95}
                            value={values.aiConfidenceThreshold}
                            onChange={(value) => set("aiConfidenceThreshold", value)}
                            hint={t("screens.admin.settings.detectionHint")}
                            error={error("aiConfidenceThreshold")}
                        />
                        <NumberField
                            id="settings-ai-low"
                            name="aiLowConfidenceThreshold"
                            label={t("screens.admin.settings.lowReview")}
                            unit="%"
                            min={5}
                            max={95}
                            value={values.aiLowConfidenceThreshold}
                            onChange={(value) => set("aiLowConfidenceThreshold", value)}
                            hint={t("screens.admin.settings.lowReviewHint")}
                            error={error("aiLowConfidenceThreshold")}
                        />
                    </div>
                    {thresholdsPreviewable && <ThresholdBands confidencePct={conf} lowConfidencePct={low} locale={locale} />}
                    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                        <div>
                            <Switch
                                id="settings-alerts"
                                name="abnormalMovementAlertsEnabled"
                                checked={values.abnormalMovementAlertsEnabled}
                                onChange={(event) => set("abnormalMovementAlertsEnabled", event.target.checked)}
                                label={t("screens.admin.settings.observations")}
                                description={t("screens.admin.settings.observationsHint")}
                            />
                            <div aria-live="polite">
                                {!values.abnormalMovementAlertsEnabled && baseline.abnormalMovementAlertsEnabled && (
                                    <InlineNote icon={TriangleAlert} tone="warning" className="mt-3">
                                        {t("screens.admin.settings.observationsPaused")}
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
                            label={t("screens.admin.settings.notifyDoctor")}
                            description={values.abnormalMovementAlertsEnabled ? t("screens.admin.settings.notifyDoctorHint") : t("screens.admin.settings.notifyDoctorOff")}
                        />
                        {!values.abnormalMovementAlertsEnabled && values.notifyDoctorOnAlert && <input type="hidden" name="notifyDoctorOnAlert" value="on" />}
                    </div>
                </FormSection>

                <FormSection
                    title={t(sectionTitleKey("medical"))}
                    description={<SectionHint modified={modified("medical")}>{t("screens.admin.settings.medicalHint")}</SectionHint>}
                >
                    <NumberField
                        id="settings-clearance-warning"
                        name="clearanceExpiryWarningDays"
                        label={t("screens.admin.settings.clearanceWarning")}
                        unit={t("screens.admin.settings.unitDays")}
                        min={1}
                        max={90}
                        value={values.clearanceExpiryWarningDays}
                        onChange={(value) => set("clearanceExpiryWarningDays", value)}
                        hint={t("screens.admin.settings.clearanceWarningHint")}
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
                                {t("screens.admin.settings.unsavedIn", { sections: dirtySections.map((section) => t(sectionTitleKey(section.id))).join(", ") })}
                            </p>
                        ) : (
                            <p className="text-fg-subtle">{t("screens.admin.common.allChangesSaved")}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" disabled={!dirty} onClick={discard}>
                            {t("screens.admin.common.discard")}
                        </Button>
                        <SubmitButton pending={form.pending} pendingLabel={t("screens.admin.common.saving")} disabled={!dirty}>
                            {t("screens.admin.common.saveChanges")}
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
                    {t("screens.admin.common.modified")}
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
