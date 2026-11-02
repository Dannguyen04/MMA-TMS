import { CircleAlert } from "lucide-react";

import { WeightChart } from "@/components/domain/weight-chart";
import { WeightStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { adherenceAlertLine } from "@/lib/domain/nutrition";
import { weightChartWindow } from "@/lib/domain/weight-chart";
import type { WeightTrack } from "@/lib/domain/weight-track";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";

/** Server Component. Without `locale` it reads the viewer's language from the request. */
export async function CampWeightCard({ track, wayOff, logHref, locale }: { track: WeightTrack; wayOff: number; logHref?: string; locale?: Locale }) {
    const lang = locale ?? (await getLocale());
    const t = createTranslator(lang);
    const window = weightChartWindow(track);
    const showAdherence = wayOff > 0 && (track.status === "OVER_LIMIT" || track.status === "ABOVE_TARGET");
    const latest = track.latestKg === null ? t("boutFighter.weight.noWeight") : `${formatNumber(track.latestKg, 1)} kg`;
    const remaining = track.remainingPct === null ? null : t("boutFighter.weight.remaining", { pct: formatNumber(track.remainingPct, 1) });

    return (
        <Card>
            <CardHeader
                title={t("boutFighter.weight.title")}
                description={[latest, remaining].filter(Boolean).join(" · ")}
                action={<WeightStatusBadge status={track.status} locale={lang} />}
            />
            <CardContent className="flex flex-col gap-4">
                {track.status === "OVER_LIMIT" && (
                    <Callout tone="danger" icon={CircleAlert} role="alert" title={t("boutMsg.redWeightRecommendation")}>
                        {showAdherence ? adherenceAlertLine(wayOff, t) : null}
                    </Callout>
                )}
                {track.status === "ABOVE_TARGET" && showAdherence && <p className="text-sm text-fg-muted">{adherenceAlertLine(wayOff, t)}</p>}
                {window && track.points.length > 0 ? (
                    <WeightChart track={track} from={window.from} to={window.to} />
                ) : (
                    <p className="text-sm text-fg-muted">{t("boutFighter.weight.noWeightsInCamp")}</p>
                )}
                {logHref && (
                    <ButtonLink href={logHref} size="lg" className="w-full sm:w-auto">
                        {t("boutFighter.weight.logWeight")}
                    </ButtonLink>
                )}
            </CardContent>
        </Card>
    );
}
