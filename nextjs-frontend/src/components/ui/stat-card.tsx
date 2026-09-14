import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface StatDelta {
    /** Pre-formatted delta, e.g. "+4" or "−2.1 kg". */
    value: string;
    direction: "up" | "down" | "flat";
    /** Whether this movement is good news. Controls color, never the arrow. */
    sentiment: "good" | "bad" | "neutral";
    /** Comparison period, e.g. "vs last week". */
    label?: string;
}

export interface StatCardProps {
    label: string;
    value: ReactNode;
    unit?: string;
    icon?: ReactNode;
    delta?: StatDelta;
    hint?: ReactNode;
    href?: string;
    /** Optional visual under the value, e.g. a sparkline or meter. */
    children?: ReactNode;
    className?: string;
}

const SENTIMENT_CLASS: Record<StatDelta["sentiment"], string> = {
    good: "text-success-fg",
    bad: "text-danger-fg",
    neutral: "text-fg-muted",
};

/** Colour carries the sentiment visually, so screen readers get it in words. A neutral movement adds nothing. */
function sentimentText({ sentiment, direction }: StatDelta): string {
    if (sentiment === "good") return "(better)";
    if (sentiment === "bad") return "(worse)";
    return direction === "flat" ? "(no change)" : "";
}

export function StatCard({ label, value, unit, icon, delta, hint, href, children, className }: StatCardProps) {
    const DeltaIcon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
    const deltaSentiment = delta ? sentimentText(delta) : "";

    const body = (
        <>
            <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-fg-muted">{label}</p>
                {icon && <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>}
            </div>
            <p className="mt-2 flex items-baseline gap-1 text-[28px] leading-none font-semibold tracking-tight text-fg">
                {value}
                {unit && <span className="text-sm font-medium text-fg-muted">{unit}</span>}
            </p>
            {(delta || hint) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    {delta && (
                        <span className={cn("inline-flex items-center gap-0.5 font-medium", SENTIMENT_CLASS[delta.sentiment])}>
                            <DeltaIcon aria-hidden className="size-3.5" />
                            {delta.value}
                            {deltaSentiment && <span className="sr-only"> {deltaSentiment}</span>}
                            {delta.label && <span className="font-normal text-fg-subtle">&nbsp;{delta.label}</span>}
                        </span>
                    )}
                    {hint && <span className="text-fg-subtle">{hint}</span>}
                </div>
            )}
            {children && <div className="mt-3">{children}</div>}
        </>
    );

    const classes = cn("block rounded-xl border border-border bg-surface p-4 shadow-card", className);

    return href ? (
        <Link href={href} className={cn(classes, "transition-colors hover:border-border-strong hover:bg-surface-muted/50")}>
            {body}
        </Link>
    ) : (
        <div className={classes}>{body}</div>
    );
}
