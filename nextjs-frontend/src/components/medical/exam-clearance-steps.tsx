import { Check, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = ["Examination", "Medical Clearance"] as const;

/**
 * Where the doctor is in the two writes that clear a fighter: the examination first, then the clearance issued from it.
 * Shown in the page header of both forms.
 */
export function ExamClearanceSteps({ current }: { current: 1 | 2 }) {
    return (
        <ol aria-label="Clearing a fighter" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {STEPS.map((label, index) => {
                const step = index + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
                        {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-fg-subtle" />}
                        <span className={cn("inline-flex items-center gap-1.5", active ? "font-semibold text-fg" : "text-fg-muted")}>
                            {done && <Check aria-hidden className="size-3.5 text-success-fg" />}
                            Step {step} of {STEPS.length}: {label}
                            {done && <span className="sr-only">(done)</span>}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
