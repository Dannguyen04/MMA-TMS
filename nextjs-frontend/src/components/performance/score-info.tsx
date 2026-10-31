"use client";

import { Info } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Tooltip } from "@/components/ui/tooltip";

/** Info button explaining how performance scores are built. The tooltip also describes the button for screen readers. */
export function ScoreInfo({ className }: { className?: string }) {
    const t = useT();
    return (
        <Tooltip content={t("screens.performance.scoreInfo.explanation")} side="bottom" className={className}>
            <button
                type="button"
                aria-label={t("screens.performance.scoreInfo.button")}
                className="inline-flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
            >
                <Info aria-hidden className="size-4" />
            </button>
        </Tooltip>
    );
}
