import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SegmentMotion } from "./segment-motion";

export interface SegmentedControlOption<T extends string> {
    value: T;
    label: ReactNode;
    /** Accessible name for icon-only labels. Include any visible text so voice control still matches. */
    ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
    /** Names the group for assistive technology. */
    label: string;
    options: SegmentedControlOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: "sm" | "md";
    className?: string;
}

/** A small set of mutually exclusive options shown side by side; each segment is a toggle button with aria-pressed. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, size = "sm", className }: SegmentedControlProps<T>) {
    return (
        <SegmentMotion as="div" role="group" aria-label={label} className={cn("inline-flex overflow-x-auto", size === "sm" && "segment-motion-compact", className)}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        data-segment={option.value}
                        aria-pressed={selected}
                        aria-label={option.ariaLabel}
                        onClick={() => onChange(option.value)}
                        className="min-w-9 tabular-nums"
                    >
                        {option.label}
                    </button>
                );
            })}
        </SegmentMotion>
    );
}
