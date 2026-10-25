"use client";

import { useT } from "@/components/i18n/locale-provider";
import { ScaleSlider } from "@/components/ui/scale-slider";
import type { MessageKey } from "@/lib/i18n/translate";
import { rpeTextFor } from "./training-utils";

export interface RpeSliderProps {
    id: string;
    name: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    /** What the number means in this form, e.g. planned intensity or what the fighter reported. */
    hint: string;
    required: boolean;
    /** Cleared maximum from the Medical Clearance, if any. */
    maxAllowed?: number | null;
    error?: string;
}

/** RPE 1–10 slider with verbal anchors and a warning above the cleared maximum, when one applies. */
export function RpeSlider({ id, name, label, value, onChange, hint, required, maxAllowed = null, error }: RpeSliderProps) {
    const t = useT();
    const overCap = maxAllowed !== null && value > maxAllowed;

    const anchors = [
        { value: 1, label: t("rpe.1" as MessageKey) },
        { value: 4, label: t("rpe.4" as MessageKey) },
        { value: 7, label: t("rpe.7" as MessageKey) },
        { value: 10, label: t("rpe.10" as MessageKey) },
    ];

    return (
        <ScaleSlider
            id={id}
            name={name}
            label={label}
            min={1}
            max={10}
            value={value}
            onChange={onChange}
            formatValue={(rpe) => rpeTextFor(t, rpe) ?? `RPE ${rpe}`}
            anchors={anchors}
            hint={maxAllowed !== null ? t("training.rpeSlider.hintMax", { hint, max: maxAllowed }) : hint}
            warning={overCap ? t("training.rpeSlider.aboveCleared", { max: maxAllowed }) : undefined}
            error={error}
            required={required}
        />
    );
}
