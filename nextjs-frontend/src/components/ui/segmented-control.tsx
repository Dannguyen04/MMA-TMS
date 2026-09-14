import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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

const SIZES = {
    sm: "h-7 min-w-9 px-2 text-xs",
    md: "h-8 min-w-9 px-3 text-[13px]",
};

/** A small set of mutually exclusive options shown side by side; each segment is a toggle button with aria-pressed. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, size = "sm", className }: SegmentedControlProps<T>) {
    return (
        <div role="group" aria-label={label} className={cn("inline-flex rounded-lg bg-surface-muted p-0.5", className)}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        aria-label={option.ariaLabel}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "rounded-md font-medium tabular-nums transition-colors",
                            SIZES[size],
                            selected ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
