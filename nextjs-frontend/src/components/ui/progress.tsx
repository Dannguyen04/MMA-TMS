import { clamp, cn } from "@/lib/utils";
import { TONE_FILL, type Tone } from "./tone";

export interface ProgressBarProps {
    value: number;
    max?: number;
    tone?: Tone;
    /** Accessible name. Rendered visibly when `showLabel` is true. */
    label: string;
    showLabel?: boolean;
    /** Text shown on the right, e.g. "68%" or "3 of 5". Defaults to a percentage. */
    valueText?: string;
    size?: "sm" | "md";
    /** When true the value text is announced but not shown. */
    hideValue?: boolean;
    className?: string;
}

export function ProgressBar({
    value,
    max = 100,
    tone = "primary",
    label,
    showLabel = false,
    valueText,
    size = "md",
    hideValue = false,
    className,
}: ProgressBarProps) {
    const pct = max === 0 ? 0 : clamp((value / max) * 100, 0, 100);
    const text = valueText ?? `${Math.round(pct)}%`;
    return (
        <div className={cn("w-full", className)}>
            {(showLabel || !hideValue) && (
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                    {showLabel ? <span className="font-medium text-fg">{label}</span> : <span />}
                    {!hideValue && <span className="text-fg-muted tabular-nums">{text}</span>}
                </div>
            )}
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={Math.round(value)}
                aria-valuetext={text}
                className={cn("overflow-hidden rounded-full bg-surface-hover", size === "sm" ? "h-1.5" : "h-2")}
            >
                <div className={cn("h-full rounded-full transition-[width] duration-500", TONE_FILL[tone])} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

/** Indeterminate bar for work with unknown duration. */
export function ProgressIndeterminate({ label, className }: { label: string; className?: string }) {
    return (
        <div role="progressbar" aria-label={label} aria-busy="true" className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-hover", className)}>
            <div className="animate-indeterminate h-full w-2/5 rounded-full bg-primary" />
        </div>
    );
}
