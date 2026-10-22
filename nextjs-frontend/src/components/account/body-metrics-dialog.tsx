"use client";

import { Scale } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { updateBodyMetricsAction } from "@/lib/actions/account";
import { formatNumber } from "@/lib/format";
import { BODY_METRIC_LIMITS, type MeasurementLimit } from "./account-limits";

export interface BodyMetricsDialogProps {
    /** Current values; null ones start empty. */
    weightKg: number | null;
    bodyFatPct: number | null;
    restingHeartRate: number | null;
    targetWeightKg: number;
    weightClassLabel: string;
}

type MetricName = keyof typeof BODY_METRIC_LIMITS;

/** "Update body metrics" button with a dialog for weight, body fat and resting heart rate. */
export function BodyMetricsDialog(props: BodyMetricsDialogProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();
    const t = useT();

    return (
        <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                <Scale aria-hidden />
                {t("account.bodyMetrics.updateButton")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("account.bodyMetrics.dialogTitle")}
                description={t("account.bodyMetrics.dialogDescription")}
                action={updateBodyMetricsAction}
                submitLabel={t("account.bodyMetrics.saveMetrics")}
                pendingLabel={t("account.profile.saving")}
                onSuccess={(state) => toast({ title: t("account.bodyMetrics.updatedToastTitle"), description: state.message })}
            >
                {(form) => <BodyMetricsFields form={form} {...props} />}
            </ActionDialog>
        </>
    );
}

function BodyMetricsFields({ form, weightKg, bodyFatPct, restingHeartRate, targetWeightKg, weightClassLabel }: BodyMetricsDialogProps & { form: ActionForm<undefined> }) {
    const [weightDraft, setWeightDraft] = useState(weightKg === null ? "" : String(weightKg));
    const t = useT();
    const { control, error } = form;
    const defaults: Record<MetricName, number | undefined> = {
        weightKg: weightKg ?? undefined,
        bodyFatPct: bodyFatPct ?? undefined,
        restingHeartRate: restingHeartRate ?? undefined,
    };

    const weight = Number(weightDraft);
    const weightValid = weightDraft.trim() !== "" && Number.isFinite(weight) && weight >= BODY_METRIC_LIMITS.weightKg.min && weight <= BODY_METRIC_LIMITS.weightKg.max;
    const gap = weightValid ? Number((weight - targetWeightKg).toFixed(1)) : null;

    const metricField = (name: MetricName, label: string, unit: string, limit: MeasurementLimit, hint: string) => {
        const fullHint = `${hint} ${t("account.bodyMetrics.allowedRange", { min: formatNumber(limit.min), max: formatNumber(limit.max), unit })}`;
        return (
            <Field label={label} htmlFor={control(name).id} required hint={fullHint} error={error(name)}>
                <Input
                    {...control(name, { hint: fullHint, required: true })}
                    type="number"
                    inputMode="decimal"
                    min={limit.min}
                    max={limit.max}
                    step={limit.step}
                    suffix={unit}
                    defaultValue={defaults[name]}
                    onChange={name === "weightKg" ? (event) => setWeightDraft(event.target.value) : undefined}
                />
            </Field>
        );
    };

    return (
        <>
            <div className="flex flex-col gap-2">
                {metricField("weightKg", t("account.bodyMetrics.weightKg"), "kg", BODY_METRIC_LIMITS.weightKg, t("account.bodyMetrics.hintWeight"))}
                <div aria-live="polite">
                    <InlineNote icon={Scale} tone={gap !== null && gap <= 0 ? "success" : "neutral"}>
                        {gap === null
                            ? t("account.bodyMetrics.limitExact", { classLabel: weightClassLabel, target: formatNumber(targetWeightKg, 1) })
                            : gap > 0
                              ? t("account.bodyMetrics.aboveLimit", { gap: formatNumber(gap, 1), classLabel: weightClassLabel, target: formatNumber(targetWeightKg, 1) })
                              : t("account.bodyMetrics.underLimit", { gap: formatNumber(Math.abs(gap), 1), classLabel: weightClassLabel, target: formatNumber(targetWeightKg, 1) })}
                    </InlineNote>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {metricField("bodyFatPct", t("account.bodyMetrics.bodyFat"), "%", BODY_METRIC_LIMITS.bodyFatPct, t("account.bodyMetrics.hintBodyFat"))}
                {metricField("restingHeartRate", t("account.bodyMetrics.restingHeartRate"), "bpm", BODY_METRIC_LIMITS.restingHeartRate, t("account.bodyMetrics.hintRhr"))}
            </div>
        </>
    );
}
