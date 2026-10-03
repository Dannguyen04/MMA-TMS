import { ProgressBar } from "@/components/ui/progress";
import { planTimeline } from "@/lib/domain/training-plan";
import type { TrainingPlan } from "@/lib/domain/types";
import { formatDate, formatShortDate } from "@/lib/format";

/** "3 Sep – 30 Oct 2026", or "from 3 Sep 2026 · no end date" for an open-ended plan. */
export function PlanDates({ plan, short = false }: { plan: Pick<TrainingPlan, "startDate" | "endDate">; short?: boolean }) {
    if (plan.endDate === null) {
        return (
            <>
                from <time dateTime={plan.startDate}>{formatDate(plan.startDate)}</time> · no end date
            </>
        );
    }
    return (
        <>
            <time dateTime={plan.startDate}>{short ? formatShortDate(plan.startDate) : formatDate(plan.startDate)}</time>
            <span aria-hidden> – </span>
            <span className="sr-only"> to </span>
            <time dateTime={plan.endDate}>{formatDate(plan.endDate)}</time>
        </>
    );
}

/** How far through its window a plan is: a progress bar, or just the week for a plan with no end date. */
export function PlanTimelineBar({ plan, now, size }: { plan: Pick<TrainingPlan, "title" | "startDate" | "endDate" | "status">; now: string; size?: "sm" }) {
    const timeline = planTimeline(plan, now);
    if (timeline.elapsedPct === null) return <p className="text-[13px] text-fg-muted">{timeline.text}</p>;
    return (
        <ProgressBar
            value={timeline.elapsedPct}
            label={`Time elapsed in ${plan.title}`}
            valueText={timeline.text}
            size={size}
            tone={plan.status === "completed" ? "success" : "primary"}
        />
    );
}
