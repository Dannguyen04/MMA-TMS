import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { Sparkline } from "@/components/charts/sparkline";
import { formatMeasure } from "@/components/domain/domain-format";
import type { Goal } from "@/lib/domain/types";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";

/** Check-in history for a goal card: count, last update and a sparkline of the measured values. */
export function GoalTrend({ goal, now }: { goal: Goal; now: string }) {
    const values = goal.history.map((checkpoint) => checkpoint.value);
    const last = goal.history[goal.history.length - 1];

    return (
        <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[13px] text-fg-muted">
                {pluralize(values.length, "check-in")}
                {last && (
                    <>
                        {" · last "}
                        <time dateTime={last.date} title={formatDateTime(last.date)}>
                            {formatRelative(last.date, now)}
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
                    ariaLabel={`${goal.metricLabel} over ${pluralize(values.length, "check-in")}, from ${formatMeasure(values[0], goal.unit)} to ${formatMeasure(values[values.length - 1], goal.unit)}`}
                />
            )}
        </div>
    );
}
