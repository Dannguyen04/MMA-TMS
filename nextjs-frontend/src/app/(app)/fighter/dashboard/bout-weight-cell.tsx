import { Scale } from "lucide-react";

import { ReadinessCell, ReadinessNumber } from "@/components/dashboard/readiness-strip";
import { WeightWarningBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import type { Bout } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";

/** Today's Weight cell during a bout: latest weight against the bout's limit, its status, and the weigh-in button. */
export function BoutWeightCell({ bout, className }: { bout: Bout; className?: string }) {
    const weight = bout.weight;
    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;
    const toCut = weight?.remainingPct != null && weight.remainingPct > 0 ? `${formatNumber(weight.remainingPct, 1)}% to cut · ` : "";

    return (
        <ReadinessCell
            label="Weight"
            value={
                <>
                    {weight?.latestKg != null ? (
                        <ReadinessNumber value={formatNumber(weight.latestKg, 1)} unit="kg" />
                    ) : (
                        <span className="text-sm font-medium text-fg-muted">No weigh-in yet</span>
                    )}
                    <WeightWarningBadge status={weight?.status ?? "GREY"} size="sm" />
                </>
            }
            hint={`${toCut}limit ${formatNumber(limitKg, 1)} kg`}
            className={className}
        >
            <ButtonLink href={routes.fighter.weighIn} className="w-full">
                <Scale aria-hidden />
                Log weight
            </ButtonLink>
        </ReadinessCell>
    );
}
