import { ChevronRight, ListChecks } from "lucide-react";
import Link from "next/link";

import { CardLink } from "@/components/dashboard/card-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { daysBetweenDates, suspensionReasonLabel, suspensionStatusOn } from "@/lib/domain/suspension-rules";
import type { CoachTodo, CoachTodoItem, CoachTodoPhase, CoachTodoSource, Suspension, SuspensionReason } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

export interface ActiveSuspensionLine {
    suspensionId: string;
    fighterId: string;
    reason: SuspensionReason;
    endsOn: string;
    daysLeft: number;
    maxAllowedTier: number;
}

export function activeSuspensionLines(suspensions: Suspension[], today: string): ActiveSuspensionLine[] {
    const byFighter = new Map<string, Suspension>();
    for (const s of suspensions) {
        if (suspensionStatusOn(s, today) !== "ACTIVE") continue;
        const prev = byFighter.get(s.fighterId);
        if (!prev || s.endsOn > prev.endsOn) byFighter.set(s.fighterId, s);
    }
    return [...byFighter.values()]
        .sort((a, b) => a.endsOn.localeCompare(b.endsOn) || a.fighterId.localeCompare(b.fighterId))
        .map((s) => ({
            suspensionId: s.id,
            fighterId: s.fighterId,
            reason: s.reason,
            endsOn: s.endsOn,
            daysLeft: daysBetweenDates(today, s.endsOn) + 1,
            maxAllowedTier: s.maxAllowedTier,
        }));
}

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

/** Sources that are late or unsafe rather than merely due: they get the warning tone and urgent badge. */
const URGENT: ReadonlySet<CoachTodoSource> = new Set([
    "REQUIREMENTS_OVERDUE",
    "WEIGHT_OVER_LIMIT",
    "WEIGHT_NOT_WEIGHED",
    "RESULT_OVERDUE",
    "WEIGHT_NOT_LOGGED",
    "SUSPENSION_AWAITING_CLEARANCE",
    "TRAINING_CONFLICTS_WITH_SUSPENSION",
]);

export interface CoachTodoCardProps {
    todo: CoachTodo | null;
    suspensions: ActiveSuspensionLine[];
    fighterNames: Map<string, string>;
    t: Translator;
    locale: Locale;
}

/** Everything open on the running bouts and active suspensions, grouped by phase (T-029, T-062). */
export function CoachTodoCard({ todo, suspensions = [], fighterNames, t, locale }: CoachTodoCardProps) {
    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("coachTodo.title")}
                icon={<ListChecks aria-hidden />}
                action={<CardLink href={routes.coach.bouts} className="min-h-11">{t("weight.allBouts")}</CardLink>}
            />
            <CardContent className="px-0 pb-2">
                {(todo === null || (todo.items.length === 0 && suspensions.length === 0)) && (
                    <p className="px-5 py-3 text-sm text-fg-muted">{t(todo === null ? "coachTodo.unavailable" : "coachTodo.empty")}</p>
                )}
                {PHASES.map((phase) => {
                    const phaseSuspensions = phase === "AFTER" ? suspensions : [];
                    const items = (todo?.items ?? [])
                        .filter((item) => (item.source === "RESULT_OVERDUE" ? "AFTER" : item.phase) === phase)
                        .sort((a, b) => Number(URGENT.has(b.source)) - Number(URGENT.has(a.source)));
                    if (items.length === 0 && phaseSuspensions.length === 0) return null;
                    const headingId = `coach-todo-phase-${phase}`;
                    return (
                        <section key={phase} aria-labelledby={headingId}>
                            <h3 id={headingId} className="px-5 pt-3 pb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                                {t(PHASE_TEXT[phase])}
                            </h3>
                            <ul className="flex flex-col">
                                {phaseSuspensions.map((line) => (
                                    <li key={line.suspensionId}>
                                        <Link
                                            href={`${routes.coach.suspensions}#suspension-${line.suspensionId}`}
                                            className="flex min-h-11 items-center gap-3 px-5 py-2.5 hover:bg-surface-hover focus-visible:bg-surface-hover"
                                        >
                                            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                                <p className="max-w-full truncate text-sm font-medium text-fg">
                                                    {fighterNames.get(line.fighterId) ?? t("weight.fighterFallback")}
                                                </p>
                                                <p className="text-xs font-medium text-warning-fg">
                                                    {plural(t, "coachTodo.SUSPENSION_ACTIVE", line.daysLeft, {
                                                        reason: suspensionReasonLabel(line.reason, t),
                                                        date: formatShortDate(line.endsOn, locale),
                                                        tier: line.maxAllowedTier,
                                                    })}
                                                </p>
                                            </div>
                                            <Badge tone="warning" size="sm">
                                                {t("coachTodo.urgent")}
                                            </Badge>
                                            <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                                        </Link>
                                    </li>
                                ))}
                                {items.map((item) => (
                                    <li key={`${item.boutId}-${item.source}`}>
                                        <Link
                                            href={
                                                item.source === "SUSPENSION_AWAITING_CLEARANCE" || item.source === "TRAINING_CONFLICTS_WITH_SUSPENSION"
                                                    ? routes.coach.suspensions
                                                    : routes.coach.bout(item.boutId)
                                            }
                                            className="flex min-h-11 items-center gap-3 px-5 py-2.5 hover:bg-surface-hover focus-visible:bg-surface-hover"
                                        >
                                            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                                <p className="max-w-full truncate text-sm font-medium text-fg">{fighterNames.get(item.fighterId) ?? t("weight.fighterFallback")}</p>
                                                <p className={URGENT.has(item.source) ? "text-xs font-medium text-warning-fg" : "text-xs font-medium text-fg"}>
                                                    {coachTodoText(item, t, locale)}
                                                </p>
                                                <p className="max-w-full truncate text-xs text-fg-muted">{item.eventName}</p>
                                            </div>
                                            {URGENT.has(item.source) && (
                                                <Badge tone="warning" size="sm">
                                                    {t("coachTodo.urgent")}
                                                </Badge>
                                            )}
                                            <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
                {todo?.truncated && <p className="px-5 pt-2 text-xs text-fg-subtle">{t("coachTodo.truncated")}</p>}
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
