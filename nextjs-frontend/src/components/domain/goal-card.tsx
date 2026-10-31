import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProgressBar } from "@/components/ui/progress";
import { goalProgressPct } from "@/lib/domain/rules";
import type { Goal } from "@/lib/domain/types";
import { daysBetween, formatDate, pluralize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { formatMeasure } from "./domain-format";
import { GoalStatusBadge } from "./status-badges";
import { TechniqueChip } from "./technique-chip";

export interface GoalCardProps {
    goal: Goal;
    /** Server time (ISO) used for days left. */
    now: string;
    /** Makes the whole card a link to the goal. */
    href?: string;
    /** Trend visual, e.g. a Sparkline of `goal.history`. */
    children?: ReactNode;
    headingLevel?: 2 | 3;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
    className?: string;
}

/** Goal progress: baseline → current → target, progress to target, status and due date. */
export function GoalCard({ goal, now, href, children, headingLevel = 3, locale, className }: GoalCardProps) {
    const t = locale ? createTranslator(locale) : null;
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const progress = goalProgressPct(goal);
    const reached = goal.lowerIsBetter ? goal.current <= goal.target : goal.current >= goal.target;
    const remaining = Math.abs(goal.target - goal.current);
    // Differences between percentages are percentage points, so "9 pts" rather than a confusing "9%".
    const remainingMeasure = goal.unit === "%" ? `${formatMeasure(remaining, "")} pts` : formatMeasure(remaining, goal.unit);
    const remainingText = t
        ? reached
            ? t("screens.shared.goal.reached")
            : t(goal.lowerIsBetter ? "screens.shared.goal.lowerNeeded" : "screens.shared.goal.moreNeeded", { measure: remainingMeasure })
        : reached
          ? "Target reached"
          : `${remainingMeasure} ${goal.lowerIsBetter ? "lower" : "more"} needed`;
    const daysLeft = daysBetween(now, goal.dueDate);
    const isOpen = goal.status === "on_track" || goal.status === "at_risk";

    return (
        <article
            className={cn(
                "relative flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-card",
                href && "transition-colors hover:border-border-strong hover:bg-surface-muted/40",
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Heading className="text-[15px] leading-6 font-semibold text-fg">
                        {href ? (
                            <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline">
                                {goal.title}
                            </Link>
                        ) : (
                            goal.title
                        )}
                    </Heading>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                        {goal.metricLabel}
                        {goal.lowerIsBetter && <span className="text-fg-subtle"> · {t ? t("screens.shared.goal.lowerIsBetter") : "lower is better"}</span>}
                    </p>
                </div>
                <GoalStatusBadge status={goal.status} size="sm" locale={locale} className="shrink-0" />
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-x-2 rounded-lg bg-surface-muted px-3 py-2.5 text-center">
                <GoalValue label={t ? t("screens.shared.goal.baseline") : "Baseline"} value={formatMeasure(goal.baseline, goal.unit)} />
                <ArrowRight aria-hidden className="mb-1 size-3.5 text-fg-subtle" />
                <GoalValue label={t ? t("screens.shared.goal.current") : "Current"} value={formatMeasure(goal.current, goal.unit)} emphasis />
                <ArrowRight aria-hidden className="mb-1 size-3.5 text-fg-subtle" />
                <GoalValue label={t ? t("screens.shared.goal.target") : "Target"} value={formatMeasure(goal.target, goal.unit)} />
            </div>

            <ProgressBar value={progress} label={t ? t("screens.shared.goal.progressLabel", { title: goal.title }) : `Progress to target for ${goal.title}`} valueText={`${progress}% · ${remainingText}`} size="sm" />

            {children && <div>{children}</div>}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
                <p className="flex items-center gap-1.5 text-fg-muted">
                    <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                    {t ? t("screens.shared.goal.due") : "Due"} <time dateTime={goal.dueDate}>{formatDate(goal.dueDate, locale)}</time>
                    {isOpen && (
                        <span className={cn("font-medium", daysLeft < 0 ? "text-warning-fg" : "text-fg")}>
                            {" · "}
                            {t
                                ? daysLeft < 0
                                    ? plural(t, "screens.shared.goal.overdue", -daysLeft)
                                    : daysLeft === 0
                                      ? t("screens.shared.goal.dueToday")
                                      : plural(t, "screens.shared.goal.daysLeft", daysLeft)
                                : daysLeft < 0
                                  ? `overdue by ${pluralize(-daysLeft, "day")}`
                                  : daysLeft === 0
                                    ? "due today"
                                    : `${pluralize(daysLeft, "day")} left`}
                        </span>
                    )}
                </p>
                {goal.technique && <TechniqueChip technique={goal.technique} size="sm" />}
            </div>
        </article>
    );
}

function GoalValue({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
    return (
        <p className="min-w-0">
            <span className="block text-[11px] tracking-wide text-fg-subtle uppercase">{label}</span>
            <span className={cn("mt-0.5 block truncate font-semibold", emphasis ? "text-lg text-fg" : "text-sm text-fg-muted")}>
                <span className="sr-only">: </span>
                {value}
            </span>
        </p>
    );
}
