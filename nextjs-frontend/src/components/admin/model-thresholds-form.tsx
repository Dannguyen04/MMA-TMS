"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { updateModelThresholdsAction, type ThresholdsData } from "@/lib/actions/admin";
import { ThresholdBands } from "./threshold-bands";

export interface ModelThresholdsFormProps {
    modelId: string;
    confidencePct: number;
    lowConfidencePct: number;
    /** Platform-wide defaults from System settings, for comparison. */
    defaults: ThresholdsData;
    /** Why editing is unavailable (e.g. deprecated model); null when editable. */
    disabledReason: string | null;
}

function parsePct(value: string): number | null {
    if (value.trim() === "") return null;
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

/** Confidence and low-confidence thresholds as linked sliders and numeric inputs, with live impact. */
export function ModelThresholdsForm({ modelId, confidencePct, lowConfidencePct, defaults, disabledReason }: ModelThresholdsFormProps) {
    const t = useT();
    const toast = useToast();
    const [confidence, setConfidence] = useState(String(confidencePct));
    const [low, setLow] = useState(String(lowConfidencePct));

    const form = useActionForm(updateModelThresholdsAction, {
        id: "thresholds",
        onSuccess: (state) => toast({ title: state.message ?? t("adminForms.thresholdsSaved") }),
    });

    const conf = parsePct(confidence);
    const lowValue = parsePct(low);
    const confError =
        conf === null || conf < 1 || conf > 98 ? t("adminForms.confRange") : undefined;
    const lowError =
        lowValue === null || lowValue < 2 || lowValue > 99
            ? t("adminForms.lowRange")
            : conf !== null && lowValue <= conf
              ? t("adminForms.lowHigher", { n: conf })
              : undefined;
    const confidenceMessage = confError ?? form.error("confidencePct");
    const lowMessage = lowError ?? form.error("lowConfidencePct");
    const dirty = conf !== confidencePct || lowValue !== lowConfidencePct;
    const valid = !confError && !lowError;
    const disabled = disabledReason !== null;

    const confHint = t("adminForms.confHint", { n: defaults.confidencePct });
    const lowHint = t("adminForms.lowHint", { n: defaults.lowConfidencePct });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <input type="hidden" name="modelId" value={modelId} />
            {disabledReason && <InlineNote icon={Info}>{disabledReason}</InlineNote>}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ThresholdControl
                    id="threshold-confidence"
                    name="confidencePct"
                    label={t("adminForms.confLabel")}
                    value={confidence}
                    onChange={(value) => {
                        setConfidence(value);
                        form.markEdited("confidencePct");
                    }}
                    hint={confHint}
                    error={confidenceMessage}
                    disabled={disabled}
                />
                <ThresholdControl
                    id="threshold-low"
                    name="lowConfidencePct"
                    label={t("adminForms.lowLabel")}
                    value={low}
                    onChange={(value) => {
                        setLow(value);
                        form.markEdited("lowConfidencePct");
                    }}
                    hint={lowHint}
                    error={lowMessage}
                    disabled={disabled}
                />
            </div>

            <div className="rounded-lg border border-border bg-surface-muted/50 p-4">
                <p className="mb-3 text-sm font-medium text-fg">{t("adminForms.impact")}</p>
                {valid && conf !== null && lowValue !== null ? (
                    <>
                        <ThresholdBands confidencePct={conf} lowConfidencePct={lowValue} />
                        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg-muted" aria-live="polite">
                            <li>{t("adminForms.discardedBelow", { n: conf })}</li>
                            <li>{t("adminForms.flaggedBand", { low: conf, high: lowValue })}</li>
                            <li>{t("adminForms.shownAbove", { n: lowValue })}</li>
                        </ul>
                    </>
                ) : (
                    <p className="text-[13px] text-fg-muted">{t("adminForms.fixThresholds")}</p>
                )}
            </div>

            <FormMessage {...form.message} />

            <div className="flex flex-wrap items-center justify-end gap-2">
                {dirty && !disabled && (
                    <p className="mr-auto text-[13px] font-medium text-warning-fg" aria-live="polite">
                        {t("adminForms.unsaved")}
                    </p>
                )}
                <Button
                    variant="secondary"
                    disabled={!dirty || disabled}
                    onClick={() => {
                        setConfidence(String(confidencePct));
                        setLow(String(lowConfidencePct));
                    }}
                >
                    {t("adminForms.reset")}
                </Button>
                <SubmitButton pending={form.pending} pendingLabel={t("adminForms.saving")} disabled={!dirty || !valid || disabled}>
                    {t("adminForms.saveThresholds")}
                </SubmitButton>
            </div>
        </form>
    );
}

function ThresholdControl({
    id,
    name,
    label,
    value,
    onChange,
    hint,
    error,
    disabled,
}: {
    id: string;
    name: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    hint: string;
    error?: string;
    disabled: boolean;
}) {
    const t = useT();
    const numeric = parsePct(value);
    return (
        <Field label={label} htmlFor={id} required hint={hint} error={error}>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={1}
                    max={99}
                    step={1}
                    value={numeric ?? 0}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={t("adminForms.slider", { label })}
                    aria-valuetext={`${numeric ?? 0}%`}
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
                />
                <div className="w-24 shrink-0">
                    <Input
                        id={id}
                        name={name}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={99}
                        step={1}
                        required
                        disabled={disabled}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        suffix="%"
                        className="text-right tabular-nums"
                    />
                </div>
            </div>
        </Field>
    );
}
