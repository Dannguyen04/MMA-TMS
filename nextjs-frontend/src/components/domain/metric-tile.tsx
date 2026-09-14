import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

import type { StatDelta } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

const SENTIMENT_CLASS: Record<StatDelta["sentiment"], string> = {
    good: "text-success-fg",
    bad: "text-danger-fg",
    neutral: "text-fg-muted",
};

const SENTIMENT_TEXT: Record<StatDelta["sentiment"], string> = {
    good: " (better)",
    bad: " (worse)",
    neutral: "",
};

export interface MetricTileProps {
    label: string;
    value: ReactNode;
    unit?: string;
    /** Change vs a comparison period; the arrow shows direction, the colour and hidden text show sentiment. */
    delta?: StatDelta;
    hint?: ReactNode;
    className?: string;
}

/** Compact metric for dense panels — a lighter sibling of StatCard. */
export function MetricTile({ label, value, unit, delta, hint, className }: MetricTileProps) {
    const DeltaIcon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;

    return (
        <div className={cn("min-w-0 rounded-lg bg-surface-muted px-3 py-2.5", className)}>
            <p className="truncate text-xs text-fg-muted">{label}</p>
            <p className="mt-1 flex items-baseline gap-1 text-lg leading-tight font-semibold text-fg">
                {value}
                {unit && <span className="text-xs font-medium text-fg-muted">{unit}</span>}
            </p>
            {(delta || hint) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    {delta && (
                        <span className={cn("inline-flex items-center gap-0.5 font-medium", SENTIMENT_CLASS[delta.sentiment])}>
                            <DeltaIcon aria-hidden className="size-3" />
                            {delta.value}
                            <span className="sr-only">{SENTIMENT_TEXT[delta.sentiment]}</span>
                            {delta.label && <span className="font-normal text-fg-subtle">&nbsp;{delta.label}</span>}
                        </span>
                    )}
                    {hint && <span className="text-fg-subtle">{hint}</span>}
                </p>
            )}
        </div>
    );
}
