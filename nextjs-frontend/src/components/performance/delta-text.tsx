import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

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

/** Inline change indicator for tiles and table cells: arrow + signed value, sentiment in colour and hidden text. */
export function DeltaText({ delta, className }: { delta: StatDelta; className?: string }) {
    const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
    return (
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap", SENTIMENT_CLASS[delta.sentiment], className)}>
            <Icon aria-hidden className="size-3 shrink-0" />
            {delta.value}
            <span className="sr-only">{SENTIMENT_TEXT[delta.sentiment]}</span>
            {delta.label && <span className="font-normal text-fg-subtle">&nbsp;{delta.label}</span>}
        </span>
    );
}
