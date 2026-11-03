import { ArrowRight } from "lucide-react";

import { formatMeasure } from "@/components/domain/domain-format";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { GOAL_STATUS_META, StatusBadge } from "@/components/domain/status-badges";
import { TechniqueChip } from "@/components/domain/technique-chip";
import { ProgressBar } from "@/components/ui/progress";
import { SortableTH, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { goalProgressPct } from "@/lib/domain/rules";
import type { Goal } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { GoalActions } from "./goal-actions";

export type GoalFighter = FighterIdentityData & { id: string };

export interface GoalsTableProps {
    goals: Goal[];
    fighters: Record<string, GoalFighter>;
    now: string;
    pathname: string;
    searchParams: SearchParams;
    sort?: string;
    direction: SortDirection;
    locale: Locale;
}

function isOpen(goal: Goal): boolean {
    return goal.status === "on_track" || goal.status === "at_risk";
}

function DueText({ goal, now, t, locale }: { goal: Goal; now: string; t: Translator; locale: Locale }) {
    const days = daysBetween(now, goal.dueDate);
    return (
        <span className="flex flex-col">
            <time dateTime={goal.dueDate} className="whitespace-nowrap text-fg">
                {formatDate(goal.dueDate, locale)}
            </time>
            {isOpen(goal) && (
                <span className={cn("text-xs whitespace-nowrap", days < 0 ? "font-medium text-warning-fg" : "text-fg-muted")}>
                    {days < 0
                        ? plural(t, "screens.performance.goalsTable.overdue", -days)
                        : days === 0
                          ? t("screens.performance.goalsTable.dueToday")
                          : plural(t, "screens.performance.goalsTable.daysLeft", days)}
                </span>
            )}
        </span>
    );
}

/** Resets table-cell padding and display so a row can become a stacked card below `md`. */
const STACKED_CELL = "max-md:block max-md:p-0 max-md:first:pl-0 max-md:last:pr-0";

/**
 * Cross-roster goal list: a sortable table on wider screens that restacks each row into a card on phones.
 * One row per goal, so each goal's actions (and their dialogs) are mounted once.
 */
export function GoalsTable({ goals, fighters, now, pathname, searchParams, sort, direction, locale }: GoalsTableProps) {
    const t = createTranslator(locale);
    const sortProps = { pathname, searchParams, activeSort: sort, direction };

    return (
        <Table caption={t("screens.performance.goalsTable.caption")} className="max-md:block">
            <THead className="max-md:hidden">
                <tr>
                    <SortableTH label={t("screens.performance.fighter")} sortKey="fighter" {...sortProps} />
                    <SortableTH label={t("screens.performance.goalsTable.goal")} sortKey="goal" {...sortProps} />
                    <SortableTH label={t("screens.performance.goalsTable.progress")} sortKey="progress" {...sortProps} />
                    <SortableTH label={t("screens.performance.status")} sortKey="status" {...sortProps} />
                    <SortableTH label={t("screens.performance.goalsTable.due")} sortKey="due" {...sortProps} />
                    <TH className="text-right">
                        <span className="sr-only">{t("screens.performance.goalsTable.actions")}</span>
                    </TH>
                </tr>
            </THead>
            <TBody className="max-md:block">
                {goals.map((goal) => {
                    const fighter = fighters[goal.fighterId];
                    const progress = goalProgressPct(goal);
                    return (
                        <TR key={goal.id} className="max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-3 max-md:px-4 max-md:py-4">
                            <TD className={cn(STACKED_CELL, "min-w-44 max-md:col-start-1 max-md:row-start-1 max-md:min-w-0")}>
                                {fighter ? (
                                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} href={routes.coach.fighterGoals(fighter.id)} />
                                ) : (
                                    <span className="text-fg-muted">{t("screens.performance.goalsTable.unknownFighter")}</span>
                                )}
                            </TD>
                            <TD className={cn(STACKED_CELL, "min-w-64 max-md:col-span-2 max-md:row-start-2 max-md:min-w-0")}>
                                <p className="font-medium text-fg">{goal.title}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                                    <span>
                                        {goal.metricLabel}
                                        {goal.lowerIsBetter && <span className="text-fg-subtle">{t("screens.performance.goalsTable.lowerIsBetter")}</span>}
                                    </span>
                                    {goal.technique && <TechniqueChip technique={goal.technique} size="sm" />}
                                </p>
                            </TD>
                            <TD className={cn(STACKED_CELL, "w-48 min-w-44 max-md:col-span-2 max-md:row-start-3 max-md:w-auto max-md:min-w-0")}>
                                <p className="mb-1 flex items-baseline justify-between gap-2 text-[13px] whitespace-nowrap">
                                    <span>
                                        <span className="font-medium text-fg">{formatMeasure(goal.current, goal.unit)}</span>
                                        <ArrowRight aria-hidden className="mx-1 inline size-3 text-fg-subtle" />
                                        <span className="sr-only">{t("screens.performance.goalsTable.target")}</span>
                                        <span className="text-fg-muted">{formatMeasure(goal.target, goal.unit)}</span>
                                    </span>
                                    <span className="text-xs text-fg-muted">{progress}%</span>
                                </p>
                                <ProgressBar
                                    value={progress}
                                    size="sm"
                                    label={t("screens.performance.goalsTable.progressLabel", { title: goal.title })}
                                    valueText={`${progress}%`}
                                    hideValue
                                />
                            </TD>
                            <TD className={cn(STACKED_CELL, "max-md:col-start-2 max-md:row-start-1 max-md:justify-self-end")}>
                                <StatusBadge meta={{ ...GOAL_STATUS_META[goal.status], label: t(`screens.performance.goalStatus.${goal.status}`) }} size="sm" />
                            </TD>
                            <TD className={cn(STACKED_CELL, "max-md:col-start-1 max-md:row-start-4 max-md:text-[13px]")}>
                                <DueText goal={goal} now={now} t={t} locale={locale} />
                            </TD>
                            <TD className={cn(STACKED_CELL, "text-right max-md:col-start-2 max-md:row-start-4")}>
                                <GoalActions
                                    goal={goal}
                                    fighterName={fighter?.name ?? t("screens.performance.goalsTable.theFighter")}
                                    now={now}
                                    variant="icons"
                                />
                            </TD>
                        </TR>
                    );
                })}
            </TBody>
        </Table>
    );
}
