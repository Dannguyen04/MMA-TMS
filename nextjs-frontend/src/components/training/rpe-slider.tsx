"use client";

import { ScaleSlider } from "@/components/ui/scale-slider";
import { rpeLabel } from "./training-utils";

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

const ANCHORS = [
    { value: 1, label: "Very light" },
    { value: 4, label: "Moderate" },
    { value: 7, label: "Hard" },
    { value: 10, label: "Maximal" },
];

/** RPE 1–10 slider with verbal anchors and a warning above the cleared maximum, when one applies. */
export function RpeSlider({ id, name, label, value, onChange, hint, required, maxAllowed = null, error }: RpeSliderProps) {
    const overCap = maxAllowed !== null && value > maxAllowed;
    return (
        <ScaleSlider
            id={id}
            name={name}
            label={label}
            min={1}
            max={10}
            value={value}
            onChange={onChange}
            formatValue={(rpe) => `RPE ${rpe} · ${rpeLabel(rpe)}`}
            anchors={ANCHORS}
            hint={maxAllowed !== null ? `${hint} Medical Clearance allows up to RPE ${maxAllowed}.` : hint}
            warning={overCap ? `Above the cleared maximum of RPE ${maxAllowed}.` : undefined}
            error={error}
            required={required}
        />
    );
}
