import { CalendarX2, ClipboardPlus, ClipboardX, Hourglass, ShieldQuestion, type LucideIcon } from "lucide-react";

import { ELIGIBILITY_REASON_DESCRIPTIONS, ELIGIBILITY_REASON_LABELS, type EligibilityReason } from "@/lib/domain/medical-contract";
import { cn } from "@/lib/utils";

const REASON_ICONS: Record<EligibilityReason, LucideIcon> = {
    EXAMINATION_REQUIRED: ClipboardPlus,
    REVIEW_REQUEST_PENDING: Hourglass,
    EXAMINATION_NOT_ELIGIBLE: ClipboardX,
    CLEARANCE_REQUIRED: ShieldQuestion,
    CLEARANCE_EXPIRED: CalendarX2,
    SESSION_TYPE_RESTRICTED: ShieldQuestion,
};

/**
 * Why the medical service won't let a fighter train right now, one reason per row in plain words. Shared by the
 * eligibility panel and the refusal shown when a session can't start.
 */
export function EligibilityReasons({ reasons, className }: { reasons: readonly EligibilityReason[]; className?: string }) {
    if (reasons.length === 0) return null;
    return (
        <ul className={cn("flex flex-col gap-2", className)}>
            {reasons.map((reason) => {
                const Icon = REASON_ICONS[reason];
                return (
                    <li key={reason} className="flex items-start gap-2.5 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] ring-1 ring-warning-border ring-inset">
                        <Icon aria-hidden className="mt-px size-4 shrink-0 text-warning-fg" />
                        <span className="min-w-0 text-pretty">
                            <span className="font-semibold text-fg">{ELIGIBILITY_REASON_LABELS[reason]}</span>
                            <span className="block text-fg-muted">{ELIGIBILITY_REASON_DESCRIPTIONS[reason]}</span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
