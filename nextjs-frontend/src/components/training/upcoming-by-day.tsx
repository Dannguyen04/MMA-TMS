import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { SessionListItem } from "@/components/domain/session-list-item";
import { Badge } from "@/components/ui/badge";
import type { TrainingSession } from "@/lib/domain/types";
import { dayKey, daysBetween, formatWeekdayDate, pluralize } from "@/lib/format";
import { groupBy } from "@/lib/utils";
import { sessionHref, type TrainingAudience } from "./session-table";

export interface UpcomingByDayProps {
    sessions: TrainingSession[];
    now: string;
    audience: TrainingAudience;
    coachNames?: Record<string, string>;
    fightersById?: Record<string, FighterIdentityData>;
    /** Heading level for the day labels. */
    headingLevel?: 3 | 4;
}

/** Sessions grouped under a heading per day, soonest first. */
export function UpcomingByDay({ sessions, now, audience, coachNames, fightersById, headingLevel = 3 }: UpcomingByDayProps) {
    const Heading = headingLevel === 3 ? "h3" : "h4";
    const sorted = [...sessions].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const groups = groupBy(sorted, (s) => dayKey(s.scheduledAt));

    return (
        <ol className="flex flex-col">
            {Object.entries(groups).map(([key, daySessions]) => {
                const offset = daysBetween(now, `${key}T12:00:00Z`);
                const relative = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : null;
                return (
                    <li key={key} className="border-t border-border first:border-t-0">
                        <Heading className="flex flex-wrap items-center gap-2 bg-surface-muted/50 px-4 py-2 text-[13px] font-semibold text-fg">
                            {formatWeekdayDate(`${key}T12:00:00Z`)}
                            {relative && (
                                <Badge tone={offset === 0 ? "primary" : "neutral"} size="sm">
                                    {relative}
                                </Badge>
                            )}
                            <span className="font-normal text-fg-muted">· {pluralize(daySessions.length, "session")}</span>
                        </Heading>
                        <ul className="divide-y divide-border">
                            {daySessions.map((session) => (
                                <li key={session.id}>
                                    <SessionListItem
                                        session={session}
                                        href={sessionHref(audience, session.id)}
                                        coachName={coachNames?.[session.coachId]}
                                        fighter={fightersById?.[session.fighterId]}
                                        showDate={false}
                                    />
                                </li>
                            ))}
                        </ul>
                    </li>
                );
            })}
        </ol>
    );
}
