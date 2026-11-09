import { CHECK_IN_COLORS } from "@/components/charts/colors";
import { painLabel } from "@/components/clinical/clinical-copy";
import { CheckInTrendTile } from "@/components/domain/check-in-charts";
import type { RecoveryCheckIn } from "@/lib/domain/types";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const RECENT_CHECK_INS = 8;

/** Latest recovery check-in with pain, mobility and strength trends. Server Component. `locale` is the viewer's language; English when omitted. */
export function CheckInTrends({ checkIns, now, className, locale = "en" }: { checkIns: RecoveryCheckIn[]; now: string; className?: string; locale?: Locale }) {
    const t = createTranslator(locale);
    const recent = checkIns.slice(-RECENT_CHECK_INS);
    const latest = recent.at(-1);
    if (!latest) {
        return <p className={cn("text-sm text-fg-muted", className)}>{t("screens.misc.checkIn.none")}</p>;
    }
    const first = recent[0];
    const count = plural(t, "screens.misc.checkIn.count", recent.length, { n: formatNumber(recent.length) });
    // The translated pain labels word the top of the scale differently, so English keeps today's.
    const pain = painLabel(latest.painLevel, locale === "en" ? undefined : locale);

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-[13px] font-semibold text-fg">{t("screens.misc.checkIn.latest")}</h3>
                <time dateTime={latest.date} title={formatDateTime(latest.date, locale)} className="text-xs text-fg-muted">
                    {formatRelative(latest.date, now, locale)}
                </time>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CheckInTrendTile
                    label={t("checkInCharts.painSeriesLabel")}
                    value={`${latest.painLevel}/10`}
                    detail={t("screens.misc.checkIn.painDetail", { label: pain, from: first.painLevel })}
                    values={recent.map((checkIn) => checkIn.painLevel)}
                    color={CHECK_IN_COLORS.pain}
                    ariaLabel={t("screens.misc.checkIn.painAria", { count, from: first.painLevel, to: latest.painLevel })}
                />
                <CheckInTrendTile
                    label={t("checkInCharts.mobilitySeriesLabel")}
                    value={`${latest.mobilityPct}%`}
                    detail={t("screens.misc.checkIn.percentDetail", { from: first.mobilityPct })}
                    values={recent.map((checkIn) => checkIn.mobilityPct)}
                    color={CHECK_IN_COLORS.mobility}
                    ariaLabel={t("screens.misc.checkIn.mobilityAria", { count, from: first.mobilityPct, to: latest.mobilityPct })}
                />
                <CheckInTrendTile
                    label={t("checkInCharts.strengthSeriesLabel")}
                    value={`${latest.strengthPct}%`}
                    detail={t("screens.misc.checkIn.percentDetail", { from: first.strengthPct })}
                    values={recent.map((checkIn) => checkIn.strengthPct)}
                    color={CHECK_IN_COLORS.strength}
                    ariaLabel={t("screens.misc.checkIn.strengthAria", { count, from: first.strengthPct, to: latest.strengthPct })}
                />
            </div>
            {latest.note && <p className="rounded-lg border border-border px-3 py-2 text-[13px] text-pretty text-fg-muted">“{latest.note}”</p>}
        </div>
    );
}
