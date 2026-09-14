"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ScaleAnchor {
    value: number;
    label: string;
}

export interface ScaleSliderProps {
    id: string;
    name: string;
    label: string;
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    /** Words for the readout and for screen readers, e.g. "RPE 6 · Hard". */
    formatValue: (value: number) => string;
    /** Verbal anchors under the track. */
    anchors?: ScaleAnchor[];
    /** Numbers for every step under the track. */
    showTicks?: boolean;
    hint?: ReactNode;
    /** Shown instead of the hint, e.g. when the value is above a cleared limit. */
    warning?: ReactNode;
    error?: string;
    required?: boolean;
}

/** Numeric scale as a native range input with a large readout, verbal anchors and optional ticks. */
export function ScaleSlider({ id, name, label, min, max, step = 1, value, onChange, formatValue, anchors = [], showTicks = false, hint, warning, error, required = false }: ScaleSliderProps) {
    const messageId = `${id}-${error ? "error" : warning ? "warning" : "hint"}`;
    const message = error ?? warning ?? hint;
    const position = (point: number) => ((point - min) / (max - min)) * 100;
    const ticks = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-sm font-medium text-fg">
                    {label}
                    {required && (
                        <span className="ml-0.5 text-danger-fg" aria-hidden>
                            *
                        </span>
                    )}
                </label>
                <p aria-hidden className={cn("text-base font-semibold tabular-nums", error ? "text-danger-fg" : warning ? "text-warning-fg" : "text-fg")}>
                    {formatValue(value)}
                </p>
            </div>
            <input
                id={id}
                name={name}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                required={required}
                onChange={(event) => onChange(Number(event.target.value))}
                aria-valuetext={formatValue(value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={message ? messageId : undefined}
                className="h-2 w-full cursor-pointer accent-[var(--primary)]"
            />
            {showTicks && (
                <div aria-hidden className="grid text-center text-[11px] text-fg-subtle tabular-nums" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(0, 1fr))` }}>
                    {ticks.map((tick) => (
                        <span key={tick} className={cn(tick === value && "font-semibold text-fg")}>
                            {tick}
                        </span>
                    ))}
                </div>
            )}
            {anchors.length > 0 && (
                <div aria-hidden className="relative h-4 text-[11px] text-fg-subtle">
                    {anchors.map((anchor) => (
                        <span
                            key={anchor.value}
                            className={cn("absolute top-0 whitespace-nowrap", anchor.value === min ? "left-0" : anchor.value === max ? "right-0" : "-translate-x-1/2")}
                            style={anchor.value === min || anchor.value === max ? undefined : { left: `${position(anchor.value)}%` }}
                        >
                            {anchor.label}
                        </span>
                    ))}
                </div>
            )}
            {message && (
                <p id={messageId} className={cn("text-[13px]", error ? "font-medium text-danger-fg" : warning ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                    {message}
                </p>
            )}
        </div>
    );
}
