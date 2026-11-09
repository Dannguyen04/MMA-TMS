import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CornerTagTone = "red" | "blue" | "gold" | "neutral" | "stage";

const TONE_CLASS: Record<CornerTagTone, string> = {
    // fg-inverse is white on the light red and navy on the brighter dark-theme red, so both stay readable.
    red: "bg-corner-red text-fg-inverse",
    blue: "bg-primary text-primary-fg",
    gold: "bg-belt-gold text-warning-solid-fg",
    neutral: "bg-surface-hover text-fg",
    // For tags sitting on a saturated or dark hero ground.
    stage: "bg-white/15 text-white",
};

/**
 * Slanted label in the style of a broadcast corner card ("Fight camp · Day 29 of 69").
 * Decoration only: it never carries a status on its own, so pair statuses with the status badges.
 */
export function CornerTag({ tone = "red", className, children }: { tone?: CornerTagTone; className?: string; children: ReactNode }) {
    return (
        <span className={cn("inline-flex w-fit -skew-x-12 items-center px-2.5 py-0.5", TONE_CLASS[tone], className)}>
            <span className="inline-flex skew-x-12 items-center gap-1.5 font-display text-[12.5px] leading-5 font-bold tracking-[0.08em] uppercase [&_svg]:size-3.5">
                {children}
            </span>
        </span>
    );
}
