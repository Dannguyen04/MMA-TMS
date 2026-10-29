import { ChevronRight, ListChecks } from "lucide-react";
import Link from "next/link";

import { CardLink } from "@/components/dashboard/card-link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CoachTodo, CoachTodoItem, CoachTodoPhase, CoachTodoSource } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

const PHASES: readonly CoachTodoPhase[] = ["BEFORE", "DURING", "AFTER"];

const TEXT: Record<CoachTodoSource, MessageKey> = {
    REQUIREMENTS_DUE: "coachTodo.REQUIREMENTS_DUE",
    REQUIREMENTS_OVERDUE: "coachTodo.REQUIREMENTS_OVERDUE",
    WEIGHT_OVER_LIMIT: "coachTodo.WEIGHT_OVER_LIMIT",
    WEIGHT_ABOVE_TARGET: "coachTodo.WEIGHT_ABOVE_TARGET",
    WEIGHT_NOT_WEIGHED: "coachTodo.WEIGHT_NOT_WEIGHED",
    TACTICS_WITHOUT_SESSIONS: "coachTodo.TACTICS_WITHOUT_SESSIONS",
    CAN_ENTER_FIGHT_WEEK: "coachTodo.CAN_ENTER_FIGHT_WEEK",
    WEIGH_IN_TODAY: "coachTodo.WEIGH_IN_TODAY",
    RESULT_OVERDUE: "coachTodo.RESULT_OVERDUE",
    WEIGHT_NOT_LOGGED: "coachTodo.WEIGHT_NOT_LOGGED",
    SUSPENSION_AWAITING_CLEARANCE: "coachTodo.SUSPENSION_AWAITING_CLEARANCE",
    TRAINING_CONFLICTS_WITH_SUSPENSION: "coachTodo.TRAINING_CONFLICTS_WITH_SUSPENSION",
};

const PHASE_TEXT: Record<CoachTodoPhase, MessageKey> = {
    BEFORE: "coachTodo.phase.BEFORE",
    DURING: "coachTodo.phase.DURING",
    AFTER: "coachTodo.phase.AFTER",
};

/** Sources that are late or unsafe rather than merely due: they get the warning tone. */
const URGENT: ReadonlySet<CoachTodoSource> = new Set([
    "REQUIREMENTS_OVERDUE",
    "WEIGHT_OVER_LIMIT",
    "RESULT_OVERDUE",
    "WEIGHT_NOT_LOGGED",
    "SUSPENSION_AWAITING_CLEARANCE",
    "TRAINING_CONFLICTS_WITH_SUSPENSION",
]);

export interface CoachTodoCardProps {
    todo: CoachTodo;
    fighterNames: Map<string, string>;
    t: Translator;
    locale: Locale;
}

/** Everything open on the running bouts, grouped by phase (T-029). Hidden when there is nothing to do. */
export function CoachTodoCard({ todo, fighterNames, t, locale }: CoachTodoCardProps) {
    if (todo.items.length === 0) return null;

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("coachTodo.title")}
                icon={<ListChecks aria-hidden />}
                action={<CardLink href={routes.coach.bouts}>{t("weight.allBouts")}</CardLink>}
            />
            <CardContent className="px-0 pb-2">
                {PHASES.map((phase) => {
                    const items = todo.items.filter((item) => item.phase === phase);
                    if (items.length === 0) return null;
                    return (
                        <section key={phase} aria-label={t(PHASE_TEXT[phase])}>
                            <h3 className="px-5 pt-3 pb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t(PHASE_TEXT[phase])}</h3>
                            <ul className="flex flex-col">
                                {items.map((item) => (
                                    <li key={`${item.boutId}-${item.source}`}>
                                        <Link
                                            href={routes.coach.bout(item.boutId)}
                                            className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover focus-visible:bg-surface-hover"
                                        >
                                            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                                <p className="max-w-full truncate text-sm font-medium text-fg">{fighterNames.get(item.fighterId) ?? t("weight.fighterFallback")}</p>
                                                <p className={URGENT.has(item.source) ? "text-xs font-medium text-warning-fg" : "text-xs font-medium text-fg"}>
                                                    {coachTodoText(item, t, locale)}
                                                </p>
                                                <p className="max-w-full truncate text-xs text-fg-muted">{item.eventName}</p>
                                            </div>
                                            <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
                {todo.truncated && <p className="px-5 pt-2 text-xs text-fg-subtle">{t("coachTodo.truncated")}</p>}
            </CardContent>
        </Card>
    );
}

export function coachTodoText(item: CoachTodoItem, t: Translator, locale: Locale): string {
    return t(TEXT[item.source], {
        count: item.count ?? 0,
        date: item.dueOn ? formatShortDate(`${item.dueOn}T12:00:00+07:00`, locale) : "",
    });
}
