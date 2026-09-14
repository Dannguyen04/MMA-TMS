"use client";

import { Scale } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { updateBodyMetricsAction } from "@/lib/actions/account";
import { formatNumber } from "@/lib/format";
import { BODY_METRIC_LIMITS, type MeasurementLimit } from "./account-limits";

export interface BodyMetricsDialogProps {
    weightKg: number;
    bodyFatPct: number;
    restingHeartRate: number;
    targetWeightKg: number;
    weightClassLabel: string;
}

type MetricName = keyof typeof BODY_METRIC_LIMITS;

/** "Update body metrics" button with a dialog for weight, body fat and resting heart rate. */
export function BodyMetricsDialog(props: BodyMetricsDialogProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                <Scale aria-hidden />
                Update body metrics
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Update body metrics"
                description="Log your latest weigh-in and morning readings. Your coaches and sports doctor see the new numbers straight away."
                action={updateBodyMetricsAction}
                submitLabel="Save metrics"
                pendingLabel="Saving…"
                onSuccess={(state) => toast({ title: "Body metrics updated", description: state.message })}
            >
                {(form) => <BodyMetricsFields form={form} {...props} />}
            </ActionDialog>
        </>
    );
}

function BodyMetricsFields({ form, weightKg, bodyFatPct, restingHeartRate, targetWeightKg, weightClassLabel }: BodyMetricsDialogProps & { form: ActionForm<undefined> }) {
    const [weightDraft, setWeightDraft] = useState(String(weightKg));
    const { control, error } = form;
    const defaults: Record<MetricName, number> = { weightKg, bodyFatPct, restingHeartRate };

    const weight = Number(weightDraft);
    const weightValid = weightDraft.trim() !== "" && Number.isFinite(weight) && weight >= BODY_METRIC_LIMITS.weightKg.min && weight <= BODY_METRIC_LIMITS.weightKg.max;
    const gap = weightValid ? Number((weight - targetWeightKg).toFixed(1)) : null;

    const metricField = (name: MetricName, label: string, unit: string, limit: MeasurementLimit, hint: string) => {
        const fullHint = `${hint} Allowed range ${formatNumber(limit.min)}–${formatNumber(limit.max)} ${unit}.`;
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
                {metricField("weightKg", "Weight", "kg", BODY_METRIC_LIMITS.weightKg, "Weigh in at the same time of day for comparable numbers.")}
                <div aria-live="polite">
                    <InlineNote icon={Scale} tone={gap !== null && gap <= 0 ? "success" : "neutral"}>
                        {gap === null
                            ? `${weightClassLabel} limit: ${formatNumber(targetWeightKg, 1)} kg.`
                            : gap > 0
                              ? `${formatNumber(gap, 1)} kg above your ${weightClassLabel} limit of ${formatNumber(targetWeightKg, 1)} kg.`
                              : `On weight — ${formatNumber(Math.abs(gap), 1)} kg under your ${weightClassLabel} limit of ${formatNumber(targetWeightKg, 1)} kg.`}
                    </InlineNote>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {metricField("bodyFatPct", "Body fat", "%", BODY_METRIC_LIMITS.bodyFatPct, "From the academy scale or caliper test.")}
                {metricField("restingHeartRate", "Resting heart rate", "bpm", BODY_METRIC_LIMITS.restingHeartRate, "Measured on waking.")}
            </div>
        </>
    );
}
