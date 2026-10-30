import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import type { StatDelta } from "@/components/ui/stat-card";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const SENTIMENT_CLASS: Record<StatDelta["sentiment"], string> = {
    good: "text-success-fg",
    bad: "text-danger-fg",
    neutral: "text-fg-muted",
};

/** Hidden sentiment words: " (better)", " (worse)"; a neutral change adds nothing. */
function sentimentText(sentiment: StatDelta["sentiment"], locale: Locale): string {
    if (sentiment === "neutral") return "";
    return createTranslator(locale)(sentiment === "good" ? "screens.performance.delta.better" : "screens.performance.delta.worse");
}

/** Inline change indicator for tiles and table cells: arrow + signed value, sentiment in colour and hidden text. */
export function DeltaText({ delta, className, locale = "en" }: { delta: StatDelta; className?: string; locale?: Locale }) {
    const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
    return (
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap", SENTIMENT_CLASS[delta.sentiment], className)}>
            <Icon aria-hidden className="size-3 shrink-0" />
            {delta.value}
            <span className="sr-only">{sentimentText(delta.sentiment, locale)}</span>
            {delta.label && <span className="font-normal text-fg-subtle">&nbsp;{delta.label}</span>}
        </span>
    );
}
