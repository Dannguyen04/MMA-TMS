import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SwitchInputProps = Omit<ComponentProps<"input">, "type" | "role">;

/**
 * Compact on/off switch: a transparent native checkbox with role="switch" over a drawn track and knob.
 * Position and colour both change between states, and the off track and knob keep 3:1 contrast in both
 * themes. Give it an accessible name with aria-label or a <label>.
 */
export function SwitchInput({ className, ...props }: SwitchInputProps) {
    return (
        <span className={cn("relative inline-flex h-5 w-9 shrink-0 align-middle", className)}>
            <input
                type="checkbox"
                role="switch"
                className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
                {...props}
            />
            <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-control-border transition-colors peer-checked:bg-primary peer-disabled:opacity-50"
            />
            <span
                aria-hidden
                className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow-card ring-1 ring-control-border transition-transform peer-checked:translate-x-4 peer-checked:bg-primary-fg peer-checked:ring-primary peer-disabled:opacity-50"
            />
        </span>
    );
}

export interface SwitchProps extends SwitchInputProps {
    id: string;
    label: ReactNode;
    description?: ReactNode;
}

/** On/off setting with its label and description beside the switch. */
export function Switch({ id, label, description, className, disabled, ...props }: SwitchProps) {
    const descriptionId = description ? `${id}-description` : undefined;
    return (
        <div className={cn("flex items-start justify-between gap-4", className)}>
            <div className="min-w-0 text-sm">
                <label htmlFor={id} className={cn("font-medium", disabled ? "cursor-not-allowed text-fg-muted" : "cursor-pointer text-fg")}>
                    {label}
                </label>
                {description && (
                    <p id={descriptionId} className="mt-0.5 text-[13px] text-fg-muted">
                        {description}
                    </p>
                )}
            </div>
            <SwitchInput id={id} disabled={disabled} aria-describedby={descriptionId} className="mt-0.5" {...props} />
        </div>
    );
}
