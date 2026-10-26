import { Scale } from "lucide-react";

import { WeightWarningBadge } from "@/components/domain/status-badges";
import { WeightChart } from "@/components/domain/weight-chart";
import { WeightFigures, WeightStatusNote } from "@/components/domain/weight-summary";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Bout } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getWeightTrack } from "@/lib/services/bouts";

export async function BoutWeightCard({ bout }: { bout: Bout }) {
    // The chart is extra: when the weight track can't be read, the figures above it still show.
    const [track, { t, locale }] = await Promise.all([nullIfServiceFails(getWeightTrack(bout.id)), getTranslator()]);
    const weight = bout.weight;
    const status = weight?.status ?? "NOT_WEIGHED";

    return (
        <Card className="min-w-0">
            <CardHeader title={t("weight.title")} icon={<Scale aria-hidden />} action={<WeightWarningBadge status={status} locale={locale} />} />
            <CardContent className="flex flex-col gap-4">
                <WeightFigures
                    latestKg={weight?.latestKg ?? null}
                    latestOn={weight?.latestOn ?? null}
                    limitKg={bout.catchweightKg ?? bout.weightLimitKg}
                    remainingPct={weight?.remainingPct ?? null}
                    catchweight={bout.catchweightKg !== null}
                    t={t}
                    locale={locale}
                />
                <WeightStatusNote status={status} audience="coach" t={t} />
                {track && <WeightChart track={track} weighInAt={bout.weighInAt} t={t} locale={locale} />}
            </CardContent>
        </Card>
    );
}
