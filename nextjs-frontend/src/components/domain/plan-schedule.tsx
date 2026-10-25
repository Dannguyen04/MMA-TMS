"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { ProgressBar } from "@/components/ui/progress";
import { planTimeline } from "@/lib/domain/training-plan";
import type { TrainingPlan } from "@/lib/domain/types";
import { formatDate, formatShortDate } from "@/lib/format";

/** Dates in the viewer’s language, including open-ended plans. */
export function PlanDates({ plan, short = false }: { plan: Pick<TrainingPlan, "startDate" | "endDate">; short?: boolean }) {
    const locale = useLocale();
    const t = useT();
    if (plan.endDate === null) {
        return (
            <>
                {t("training.dates.from")} <time dateTime={plan.startDate}>{formatDate(plan.startDate, locale)}</time> · {t("training.dates.noEndDateText")}
            </>
        );
    }
    return (
        <>
            <time dateTime={plan.startDate}>{short ? formatShortDate(plan.startDate, locale) : formatDate(plan.startDate, locale)}</time>
            <span aria-hidden> – </span>
            <span className="sr-only">{t("training.dates.to")}</span>
            <time dateTime={plan.endDate}>{formatDate(plan.endDate, locale)}</time>
        </>
    );
}

/** How far through its window a plan is: a progress bar, or just the week for a plan with no end date. */
export function PlanTimelineBar({ plan, now, size }: { plan: Pick<TrainingPlan, "title" | "startDate" | "endDate" | "status">; now: string; size?: "sm" }) {
    const t = useT();
    const locale = useLocale();
    const timeline = planTimeline(plan, now, locale);
    const text = timeline.text;
    if (timeline.elapsedPct === null) return <p className="text-[13px] text-fg-muted">{text}</p>;
    return (
        <ProgressBar
            value={timeline.elapsedPct}
            label={t("training.plan.timeElapsed", { title: plan.title })}
            valueText={text}
            size={size}
            tone={plan.status === "completed" ? "success" : "primary"}
        />
    );
}
