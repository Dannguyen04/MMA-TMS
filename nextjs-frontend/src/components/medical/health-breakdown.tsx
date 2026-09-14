import { HEALTH_STATUS_META } from "@/components/domain/status-badges";
import { TONE_FILL, TONE_TEXT } from "@/components/ui/tone";
import type { HealthStatus } from "@/lib/domain/types";
import { cn, sum } from "@/lib/utils";

/** Most reassuring first, most restrictive last — the bar reads left to right from "fine" to "stop". */
const ORDER: HealthStatus[] = ["healthy", "monitoring", "recovery", "injured", "not_cleared"];

/** Stacked mini bar of health statuses with a labelled legend (counts never rely on colour). */
export function HealthBreakdown({ counts, className }: { counts: Record<HealthStatus, number>; className?: string }) {
    const total = sum(ORDER.map((status) => counts[status]));
    const present = ORDER.filter((status) => counts[status] > 0);
    const description = present.map((status) => `${counts[status]} ${HEALTH_STATUS_META[status].label.toLowerCase()}`).join(", ");

    return (
        <div className={cn("flex flex-col gap-2.5", className)}>
            <div role="img" aria-label={`Health status breakdown: ${description || "no fighters"}`} className="flex h-2 gap-0.5">
                {total === 0 ? (
                    <span className="h-full w-full rounded-full bg-surface-hover" />
                ) : (
                    present.map((status) => (
                        <span
                            key={status}
                            className={cn("h-full rounded-full first:rounded-l-full last:rounded-r-full", TONE_FILL[HEALTH_STATUS_META[status].tone])}
                            style={{ width: `${(counts[status] / total) * 100}%` }}
                        />
                    ))
                )}
            </div>
            <ul aria-hidden className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {present.map((status) => {
                    const meta = HEALTH_STATUS_META[status];
                    const Icon = meta.icon;
                    return (
                        <li key={status} className="inline-flex items-center gap-1">
                            <Icon className={cn("size-3.5", TONE_TEXT[meta.tone])} strokeWidth={2.25} />
                            <span className="text-fg-muted">{meta.label}</span>
                            <span className="font-semibold text-fg tabular-nums">{counts[status]}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
