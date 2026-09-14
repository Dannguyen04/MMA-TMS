import { RESTRICTION_SEVERITY_META } from "@/components/domain/restriction-list";
import { TONE_SOFT } from "@/components/ui/tone";
import { restrictionSeverity } from "@/lib/domain/clearance-rules";
import type { TrainingRestriction } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Restriction labels as compact chips for dense rows. Icon and tone follow RestrictionList: a ban
 * blocks a training type, a gauge caps intensity, a shield asks the coach to acknowledge
 * techniques or protect an area. Labels wrap rather than truncate, so no restriction is cut off.
 */
export function RestrictionSummary({ restrictions, className }: { restrictions: TrainingRestriction[]; className?: string }) {
    return (
        <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Restrictions">
            {restrictions.map((restriction) => {
                const { icon: Icon, tone } = RESTRICTION_SEVERITY_META[restrictionSeverity(restriction)];
                return (
                    <li key={restriction.id} className="max-w-full min-w-0">
                        <span
                            className={cn(
                                "inline-flex max-w-full items-start gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium ring-1 ring-inset",
                                TONE_SOFT[tone],
                                "bg-transparent",
                            )}
                        >
                            <Icon aria-hidden className="mt-0.5 size-3 shrink-0" strokeWidth={2.25} />
                            <span className="min-w-0 text-pretty break-words">{restriction.label}</span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
