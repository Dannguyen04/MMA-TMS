import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import type { TrainingSession } from "@/lib/domain/types";
import { dayKey, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FighterIdentityData } from "./fighter-identity";
import { DateBlock, SessionListItem } from "./session-list-item";

const DAY_MS = 86_400_000;
const HALF_DAY_MS = DAY_MS / 2;

export interface WeekAgendaProps {
    sessions: TrainingSession[];
    /** Any ISO timestamp on the first day to show (usually Monday). */
    startDate: string;
    /** Server time (ISO) used to highlight today. */
    now: string;
    /** Link for each session. Server Component only — functions can't be passed to client components. */
    getHref?: (session: TrainingSession) => string;
    /** Staff views: fighters by id, to show whose session each item is. */
    fightersById?: Record<string, FighterIdentityData>;
    className?: string;
}

/**
 * Seven-day agenda: a column per day on large screens. Below `lg` it is a list of days where today and
 * tomorrow are open and every other day with sessions is a collapsed disclosure row ("3 sessions").
 */
export function WeekAgenda({ sessions, startDate, now, getHref, fightersById, className }: WeekAgendaProps) {
    const todayKey = dayKey(now);
    const tomorrowKey = dayKey(new Date(Date.parse(now) + DAY_MS));
    // Anchor each day at midday UTC of its calendar date so the academy-timezone day key is stable.
    const firstDayMs = Date.parse(`${dayKey(startDate)}T00:00:00Z`) + HALF_DAY_MS;
    const days = Array.from({ length: 7 }, (_, offset) => {
        const iso = new Date(firstDayMs + offset * DAY_MS).toISOString();
        const key = dayKey(iso);
        return {
            iso,
            key,
            sessions: sessions
                .filter((session) => dayKey(session.scheduledAt) === key)
                .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
        };
    });

    return (
        <ol className={cn("grid gap-2 lg:grid-cols-7 lg:gap-2.5", className)}>
            {days.map((day) => {
                const isToday = day.key === todayKey;
                const heading = (
                    <>
                        <DateBlock date={day.iso} highlighted={isToday} />
                        {isToday && <span className="text-[11px] font-semibold text-primary-soft-fg uppercase lg:pr-1">Today</span>}
                    </>
                );
                const content =
                    day.sessions.length === 0 ? (
                        <p className="py-2 text-[13px] text-fg-subtle lg:py-1">Rest day</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {day.sessions.map((session) => (
                                <li key={session.id}>
                                    <SessionListItem session={session} href={getHref?.(session)} fighter={fightersById?.[session.fighterId]} compact />
                                </li>
                            ))}
                        </ul>
                    );
                const open = isToday || day.key === tomorrowKey || day.sessions.length === 0;

                return (
                    <li
                        key={day.key}
                        aria-current={isToday ? "date" : undefined}
                        className={cn("min-w-0 rounded-lg", isToday ? "bg-primary-soft/60 ring-1 ring-primary/25 ring-inset" : "bg-surface-muted/40")}
                    >
                        {open ? <OpenDay heading={heading}>{content}</OpenDay> : <CollapsibleDay date={day.iso} count={day.sessions.length} heading={heading}>{content}</CollapsibleDay>}
                    </li>
                );
            })}
        </ol>
    );
}

function OpenDay({ heading, children }: { heading: ReactNode; children: ReactNode }) {
    return (
        <div className="flex gap-3 p-2 lg:flex-col lg:gap-2">
            <h3 className="flex shrink-0 flex-col items-center gap-1 lg:flex-row lg:justify-between">{heading}</h3>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

/**
 * A day that stays a column on large screens but folds into a disclosure row below `lg`. On `lg` the
 * summary is hidden and the content is forced visible, so the week grid never depends on the open state.
 */
function CollapsibleDay({ date, count, heading, children }: { date: string; count: number; heading: ReactNode; children: ReactNode }) {
    return (
        <details className="group lg:details-content:[content-visibility:visible]">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-2 hover:bg-surface-hover/60 lg:hidden [&::-webkit-details-marker]:hidden">
                <DateBlock date={date} />
                <span className="min-w-0 flex-1 text-[13px] font-medium text-fg">{pluralize(count, "session")}</span>
                <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-2 px-2 pb-2 pl-17 lg:p-2">
                <h3 className="hidden shrink-0 lg:flex lg:flex-row lg:items-center lg:justify-between">{heading}</h3>
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </details>
    );
}
