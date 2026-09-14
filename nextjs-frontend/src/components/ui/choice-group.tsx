"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { TONE_SOFT, type Tone } from "./tone";

export interface ChoiceOption<T extends string> {
    value: T;
    label: string;
    description?: ReactNode;
    /** Shown as a tinted tile (card) or inline before the label (compact). */
    icon?: LucideIcon;
    /** Tint of the icon tile. */
    tone?: Tone;
    /** Extra content under the description, e.g. a restriction badge. */
    extra?: ReactNode;
    disabled?: boolean;
}

export interface ChoiceGroupProps<T extends string> {
    /** Base id for the hint and error elements. */
    id: string;
    name: string;
    legend: ReactNode;
    legendVisuallyHidden?: boolean;
    options: ChoiceOption<T>[];
    value: T | "";
    onChange: (value: T) => void;
    required?: boolean;
    hint?: ReactNode;
    error?: string;
    columns?: 1 | 2 | 3;
    variant?: "card" | "compact";
    className?: string;
}

const COLUMNS = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
} as const;

/**
 * Single choice as selectable cards backed by native radios: arrow keys move, the form submits the value.
 * The group carries aria-invalid/aria-required (radios themselves don't support aria-invalid).
 */
export function ChoiceGroup<T extends string>({
    id,
    name,
    legend,
    legendVisuallyHidden = false,
    options,
    value,
    onChange,
    required = false,
    hint,
    error,
    columns = 1,
    variant = "card",
    className,
}: ChoiceGroupProps<T>) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy = error ? errorId : hint ? hintId : undefined;
    const compact = variant === "compact";

    return (
        <fieldset
            role="radiogroup"
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            data-invalid={error ? "true" : undefined}
            className={cn("flex min-w-0 flex-col gap-1.5", className)}
        >
            <legend className={legendVisuallyHidden ? "sr-only" : "mb-1.5 text-sm font-medium text-fg"}>
                {legend}
                {required && (
                    <>
                        <span className="ml-0.5 text-danger-fg" aria-hidden>
                            *
                        </span>
                        <span className="sr-only"> (required)</span>
                    </>
                )}
            </legend>
            <div className={cn("grid gap-2", COLUMNS[columns])}>
                {options.map((option) => {
                    const Icon = option.icon;
                    const tile = Icon && !compact;
                    return (
                        <label
                            key={option.value}
                            className={cn(
                                "relative flex min-w-0 cursor-pointer items-start rounded-lg border bg-surface shadow-card transition-colors",
                                compact ? "gap-2.5 px-3 py-2.5" : "gap-3 p-3",
                                error ? "border-danger-solid" : "border-border hover:border-control-border",
                                "has-checked:border-primary has-checked:bg-primary-soft/40 has-checked:ring-2 has-checked:ring-primary",
                                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                                "has-disabled:cursor-not-allowed has-disabled:opacity-60",
                            )}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={option.value}
                                checked={value === option.value}
                                onChange={() => onChange(option.value)}
                                disabled={option.disabled}
                                required={required}
                                aria-describedby={describedBy}
                                className={tile ? "sr-only" : "mt-0.5 size-4 shrink-0 accent-[var(--primary)]"}
                            />
                            {tile && (
                                <span
                                    aria-hidden
                                    className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", TONE_SOFT[option.tone ?? "neutral"])}
                                >
                                    <Icon className="size-[18px]" strokeWidth={2.25} />
                                </span>
                            )}
                            <span className="min-w-0 flex-1">
                                <span className={cn("flex items-center gap-1.5 text-sm text-fg", compact ? "font-medium" : "font-semibold")}>
                                    {Icon && compact && <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" />}
                                    <span className="min-w-0">{option.label}</span>
                                </span>
                                {option.description && (
                                    <span className={cn("mt-0.5 block text-pretty text-fg-muted", compact ? "text-xs" : "text-[13px]")}>{option.description}</span>
                                )}
                                {option.extra}
                            </span>
                        </label>
                    );
                })}
            </div>
            {hint && !error && (
                <p id={hintId} className="text-[13px] text-fg-subtle">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} className="text-[13px] font-medium text-danger-fg">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
