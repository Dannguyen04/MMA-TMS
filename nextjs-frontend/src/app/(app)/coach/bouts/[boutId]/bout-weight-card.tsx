import { Scale } from "lucide-react";

import { WeightWarningBadge } from "@/components/domain/status-badges";
import { WeightChart } from "@/components/domain/weight-chart";
import { WeightFigures, WeightStatusNote } from "@/components/domain/weight-summary";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Bout } from "@/lib/domain/types";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getWeightTrack } from "@/lib/services/bouts";

export async function BoutWeightCard({ bout }: { bout: Bout }) {
    // The chart is extra: when the weight track can't be read, the figures above it still show.
    const track = await nullIfServiceFails(getWeightTrack(bout.id));
    const weight = bout.weight;
    const status = weight?.status ?? "GREY";

    return (
        <Card className="min-w-0">
            <CardHeader title="Weight" icon={<Scale aria-hidden />} action={<WeightWarningBadge status={status} />} />
            <CardContent className="flex flex-col gap-4">
                <WeightFigures
                    latestKg={weight?.latestKg ?? null}
                    latestOn={weight?.latestOn ?? null}
                    limitKg={bout.catchweightKg ?? bout.weightLimitKg}
                    remainingPct={weight?.remainingPct ?? null}
                    catchweight={bout.catchweightKg !== null}
                />
                <WeightStatusNote status={status} audience="coach" />
                {track && <WeightChart track={track} weighInAt={bout.weighInAt} />}
            </CardContent>
        </Card>
    );
}
