import { WeightStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WeightTrack } from "@/lib/domain/weight-track";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** Compact camp weight on Today. The chart itself lives on the bout page. Without `locale` it reads the viewer's language. */
export async function FighterWeightCard({ event, track, locale }: { event: string | null; track: WeightTrack | null; locale?: Locale }) {
    const lang = locale ?? (await getLocale());
    const t = createTranslator(lang);
    const description = !track
        ? t("boutFighter.weight.noBout")
        : track.latestKg === null
          ? t("boutFighter.weight.noWeightYet")
          : `${formatNumber(track.latestKg, 1)} kg${track.remainingPct === null ? "" : ` · ${t("boutFighter.weight.remaining", { pct: formatNumber(track.remainingPct, 1) })}`}`;

    return (
        <Card>
            <CardHeader
                title={event ?? t("boutFighter.weight.todayTitle")}
                description={description}
                action={track ? <WeightStatusBadge status={track.status} locale={lang} /> : undefined}
            />
            <CardContent>
                <ButtonLink href={routes.fighter.weighIn} size="lg" className="w-full sm:w-auto">
                    {t("boutFighter.weight.logToday")}
                </ButtonLink>
            </CardContent>
        </Card>
    );
}
