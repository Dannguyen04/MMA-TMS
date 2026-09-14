"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
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
    const toast = useToast();
    const [confidence, setConfidence] = useState(String(confidencePct));
    const [low, setLow] = useState(String(lowConfidencePct));

    const form = useActionForm(updateModelThresholdsAction, {
        id: "thresholds",
        onSuccess: (state) => toast({ title: state.message ?? "Thresholds saved." }),
    });

    const conf = parsePct(confidence);
    const lowValue = parsePct(low);
    const confError =
        conf === null || conf < 1 || conf > 98 ? "Enter a whole number between 1% and 98%." : undefined;
    const lowError =
        lowValue === null || lowValue < 2 || lowValue > 99
            ? "Enter a whole number between 2% and 99%."
            : conf !== null && lowValue <= conf
              ? `Must be higher than the confidence threshold (${conf}%).`
              : undefined;
    const confidenceMessage = confError ?? form.error("confidencePct");
    const lowMessage = lowError ?? form.error("lowConfidencePct");
    const dirty = conf !== confidencePct || lowValue !== lowConfidencePct;
    const valid = !confError && !lowError;
    const disabled = disabledReason !== null;

    const confHint = `Detections below this are discarded. Platform default ${defaults.confidencePct}%.`;
    const lowHint = `Detections below the low-confidence threshold are flagged “Needs review” for coaches. Platform default ${defaults.lowConfidencePct}%.`;

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <input type="hidden" name="modelId" value={modelId} />
            {disabledReason && <InlineNote icon={Info}>{disabledReason}</InlineNote>}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ThresholdControl
                    id="threshold-confidence"
                    name="confidencePct"
                    label="Confidence threshold"
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
                    label="Low-confidence threshold"
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
                <p className="mb-3 text-sm font-medium text-fg">Impact on model output</p>
                {valid && conf !== null && lowValue !== null ? (
                    <>
                        <ThresholdBands confidencePct={conf} lowConfidencePct={lowValue} />
                        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg-muted" aria-live="polite">
                            <li>Detections below {conf}% are discarded and never shown.</li>
                            <li>
                                Detections from {conf}% up to {lowValue}% are kept but flagged “Needs review” for coaches.
                            </li>
                            <li>Detections at {lowValue}% or above are shown without a review flag.</li>
                        </ul>
                    </>
                ) : (
                    <p className="text-[13px] text-fg-muted">Fix the thresholds above to preview their effect.</p>
                )}
            </div>

            <FormMessage {...form.message} />

            <div className="flex flex-wrap items-center justify-end gap-2">
                {dirty && !disabled && (
                    <p className="mr-auto text-[13px] font-medium text-warning-fg" aria-live="polite">
                        Unsaved changes
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
                    Reset
                </Button>
                <SubmitButton pending={form.pending} pendingLabel="Saving…" disabled={!dirty || !valid || disabled}>
                    Save thresholds
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
                    aria-label={`${label} slider`}
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
