import { WeightStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WeightTrack } from "@/lib/domain/weight-track";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";

/** Compact camp weight on Today. The chart itself lives on the bout page. */
export function FighterWeightCard({ event, track }: { event: string | null; track: WeightTrack | null }) {
    const description = !track
        ? "No upcoming bout"
        : track.latestKg === null
          ? "No weight logged yet"
          : `${formatNumber(track.latestKg, 1)} kg${track.remainingPct === null ? "" : ` · ${formatNumber(track.remainingPct, 1)}% remaining`}`;

    return (
        <Card>
            <CardHeader title={event ?? "Today's weight"} description={description} action={track ? <WeightStatusBadge status={track.status} /> : undefined} />
            <CardContent>
                <ButtonLink href={routes.fighter.weighIn} size="lg" className="w-full sm:w-auto">
                    Log today&apos;s weight
                </ButtonLink>
            </CardContent>
        </Card>
    );
}
