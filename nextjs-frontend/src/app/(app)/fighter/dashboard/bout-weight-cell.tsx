import { Scale } from "lucide-react";

import { ReadinessCell, ReadinessNumber } from "@/components/dashboard/readiness-strip";
import { WeightWarningBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import type { Bout } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** Today's Weight cell during a bout: latest weight against the bout's limit, its status, and the weigh-in button. */
export function BoutWeightCell({ bout, t, locale, className }: { bout: Bout; t: Translator; locale: Locale; className?: string }) {
    const weight = bout.weight;
    const limit = formatNumber(bout.catchweightKg ?? bout.weightLimitKg, 1);
    const toCut = weight?.remainingPct != null && weight.remainingPct > 0 ? formatNumber(weight.remainingPct, 1) : null;

    return (
        <ReadinessCell
            label={t("weight.title")}
            value={
                <>
                    {weight?.latestKg != null ? (
                        <ReadinessNumber value={formatNumber(weight.latestKg, 1)} unit="kg" />
                    ) : (
                        <span className="text-sm font-medium text-fg-muted">{t("weight.noWeighInYet")}</span>
                    )}
                    <WeightWarningBadge status={weight?.status ?? "GREY"} size="sm" locale={locale} />
                </>
            }
            hint={toCut ? t("weight.cellHint", { toCut, limit }) : t("weight.cellHintLimit", { limit })}
            className={className}
        >
            <ButtonLink href={routes.fighter.weighIn} className="w-full">
                <Scale aria-hidden />
                {t("weight.logWeight")}
            </ButtonLink>
        </ReadinessCell>
    );
}
