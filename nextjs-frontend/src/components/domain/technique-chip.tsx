import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface TechniqueChipProps {
    technique: Technique;
    size?: "sm" | "md";
    className?: string;
}

/** Technique label with its chart swatch. The label carries the meaning; the swatch links it to charts. */
export function TechniqueChip({ technique, size = "md", className }: TechniqueChipProps) {
    return (
        <span
            className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface font-medium whitespace-nowrap text-fg",
                size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
                className,
            )}
        >
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: TECHNIQUE_COLOR[technique] }} />
            <span className="truncate">{TECHNIQUE_LABELS[technique]}</span>
        </span>
    );
}

export interface TechniqueChipsProps {
    techniques: Technique[];
    /** Accessible name for the list, e.g. "Focus areas". */
    label: string;
    size?: "sm" | "md";
    className?: string;
}

/** Wrapping list of technique chips. Renders nothing for an empty list. */
export function TechniqueChips({ techniques, label, size, className }: TechniqueChipsProps) {
    if (techniques.length === 0) return null;
    return (
        <ul aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
            {techniques.map((technique) => (
                <li key={technique} className="max-w-full">
                    <TechniqueChip technique={technique} size={size} />
                </li>
            ))}
        </ul>
    );
}
