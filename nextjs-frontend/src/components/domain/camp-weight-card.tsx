import { CircleAlert } from "lucide-react";

import { WeightChart } from "@/components/domain/weight-chart";
import { WeightStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { adherenceAlertLine, RED_WEIGHT_RECOMMENDATION } from "@/lib/domain/nutrition";
import { weightChartWindow } from "@/lib/domain/weight-chart";
import type { WeightTrack } from "@/lib/domain/weight-track";
import { formatNumber } from "@/lib/format";

export function CampWeightCard({ track, wayOff, logHref }: { track: WeightTrack; wayOff: number; logHref?: string }) {
    const window = weightChartWindow(track);
    const showAdherence = wayOff > 0 && (track.status === "RED" || track.status === "YELLOW");
    const latest = track.latestKg === null ? "No weight logged" : `${formatNumber(track.latestKg, 1)} kg`;
    const remaining = track.remainingPct === null ? null : `${formatNumber(track.remainingPct, 1)}% remaining`;

    return (
        <Card>
            <CardHeader
                title="Weight"
                description={[latest, remaining].filter(Boolean).join(" · ")}
                action={<WeightStatusBadge status={track.status} />}
            />
            <CardContent className="flex flex-col gap-4">
                {track.status === "RED" && (
                    <Callout tone="danger" icon={CircleAlert} role="alert" title={RED_WEIGHT_RECOMMENDATION}>
                        {showAdherence ? adherenceAlertLine(wayOff) : null}
                    </Callout>
                )}
                {track.status === "YELLOW" && showAdherence && <p className="text-sm text-fg-muted">{adherenceAlertLine(wayOff)}</p>}
                {window ? <WeightChart track={track} from={window.from} to={window.to} /> : <p className="text-sm text-fg-muted">No camp days to chart yet.</p>}
                {logHref && (
                    <ButtonLink href={logHref} size="lg" className="w-full sm:w-auto">
                        Log weight
                    </ButtonLink>
                )}
            </CardContent>
        </Card>
    );
}
