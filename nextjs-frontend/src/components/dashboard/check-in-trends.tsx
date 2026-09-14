import { CHECK_IN_COLORS } from "@/components/charts/colors";
import { painLabel } from "@/components/clinical/clinical-copy";
import { CheckInTrendTile } from "@/components/domain/check-in-charts";
import type { RecoveryCheckIn } from "@/lib/domain/types";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const RECENT_CHECK_INS = 8;

/** Latest recovery check-in with pain, mobility and strength trends. Server Component. */
export function CheckInTrends({ checkIns, now, className }: { checkIns: RecoveryCheckIn[]; now: string; className?: string }) {
    const recent = checkIns.slice(-RECENT_CHECK_INS);
    const latest = recent.at(-1);
    if (!latest) {
        return <p className={cn("text-sm text-fg-muted", className)}>No check-ins yet. Your doctor or physio records how you feel at each visit.</p>;
    }
    const first = recent[0];
    const span = `over the last ${pluralize(recent.length, "check-in")}`;

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-[13px] font-semibold text-fg">Latest check-in</h3>
                <time dateTime={latest.date} title={formatDateTime(latest.date)} className="text-xs text-fg-muted">
                    {formatRelative(latest.date, now)}
                </time>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CheckInTrendTile
                    label="Pain"
                    value={`${latest.painLevel}/10`}
                    detail={`${painLabel(latest.painLevel)} · was ${first.painLevel}/10`}
                    values={recent.map((checkIn) => checkIn.painLevel)}
                    color={CHECK_IN_COLORS.pain}
                    ariaLabel={`Pain ${span}, from ${first.painLevel} to ${latest.painLevel} out of 10`}
                />
                <CheckInTrendTile
                    label="Mobility"
                    value={`${latest.mobilityPct}%`}
                    detail={`vs healthy side · was ${first.mobilityPct}%`}
                    values={recent.map((checkIn) => checkIn.mobilityPct)}
                    color={CHECK_IN_COLORS.mobility}
                    ariaLabel={`Mobility ${span}, from ${first.mobilityPct}% to ${latest.mobilityPct}%`}
                />
                <CheckInTrendTile
                    label="Strength"
                    value={`${latest.strengthPct}%`}
                    detail={`vs healthy side · was ${first.strengthPct}%`}
                    values={recent.map((checkIn) => checkIn.strengthPct)}
                    color={CHECK_IN_COLORS.strength}
                    ariaLabel={`Strength ${span}, from ${first.strengthPct}% to ${latest.strengthPct}%`}
                />
            </div>
            {latest.note && <p className="rounded-lg border border-border px-3 py-2 text-[13px] text-pretty text-fg-muted">“{latest.note}”</p>}
        </div>
    );
}
