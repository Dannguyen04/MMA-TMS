"use client";

import { Info } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";

const EXPLANATION =
    "Scores (0–100) combine AI video metrics and coach-rated session quality. Each week is compared with the average of the 4 complete weeks before it; the running week is added once it ends.";

/** Info button explaining how performance scores are built. The tooltip also describes the button for screen readers. */
export function ScoreInfo({ className }: { className?: string }) {
    return (
        <Tooltip content={EXPLANATION} side="bottom" className={className}>
            <button
                type="button"
                aria-label="About performance scores"
                className="inline-flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
            >
                <Info aria-hidden className="size-4" />
            </button>
        </Tooltip>
    );
}
