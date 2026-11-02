import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { Sparkline } from "@/components/charts/sparkline";
import { formatMeasure } from "@/components/domain/domain-format";
import type { Goal } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";

/** Check-in history for a goal card: count, last update and a sparkline of the measured values. */
export function GoalTrend({ goal, now, locale }: { goal: Goal; now: string; locale: Locale }) {
    const t = createTranslator(locale);
    const values = goal.history.map((checkpoint) => checkpoint.value);
    const last = goal.history[goal.history.length - 1];
    const checkIns = plural(t, "screens.performance.goalTrend.checkIns", values.length);

    return (
        <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[13px] text-fg-muted">
                {checkIns}
                {last && (
                    <>
                        {t("screens.performance.goalTrend.last")}
                        <time dateTime={last.date} title={formatDateTime(last.date, locale)}>
                            {formatRelative(last.date, now, locale)}
                        </time>
                    </>
                )}
            </p>
            {values.length >= 2 && (
                <Sparkline
                    values={values}
                    color={goal.technique ? TECHNIQUE_COLOR[goal.technique] : "var(--primary)"}
                    width={112}
                    height={28}
                    className="shrink-0"
                    ariaLabel={t("screens.performance.goalTrend.sparkline", {
                        metric: goal.metricLabel,
                        checkIns,
                        from: formatMeasure(values[0], goal.unit),
                        to: formatMeasure(values[values.length - 1], goal.unit),
                    })}
                />
            )}
        </div>
    );
}
