import { Clock, Gauge, UserRound } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { TrainingSession } from "@/lib/domain/types";
import { APP_TIMEZONE, dayKey, formatDate, formatMinutes, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FighterIdentity, type FighterIdentityData } from "./fighter-identity";
import { SessionStatusBadge } from "./status-badges";
import { TrainingTypeIcon } from "./training-type-icon";

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, weekday: "short" });

export interface DateBlockProps {
    /** Any ISO timestamp on the day to show. */
    date: string;
    /** Emphasise the block, e.g. for today. */
    highlighted?: boolean;
    className?: string;
}

/** Calendar tile: short weekday over the day number, in the academy timezone. */
export function DateBlock({ date, highlighted = false, className }: DateBlockProps) {
    const dayNumber = Number(dayKey(date).slice(8));
    return (
        <span
            className={cn(
                "flex w-12 shrink-0 flex-col items-center justify-center rounded-lg py-1.5 leading-none",
                highlighted ? "bg-primary text-primary-fg" : "bg-surface-muted text-fg",
                className,
            )}
        >
            <span aria-hidden className={cn("text-[11px] font-semibold uppercase", highlighted ? "text-primary-fg" : "text-fg-muted")}>
                {weekdayFmt.format(new Date(date))}
            </span>
            <span aria-hidden className="mt-1 text-lg font-semibold">
                {dayNumber}
            </span>
            <span className="sr-only">{formatDate(date)}</span>
        </span>
    );
}

/** "45m", "1h" or "1h 15m": a duration that fits a narrow agenda column. */
function shortDuration(minutes: number): string {
    const rounded = Math.round(minutes);
    if (rounded < 60) return `${rounded}m`;
    const rest = rounded % 60;
    return rest === 0 ? `${Math.floor(rounded / 60)}h` : `${Math.floor(rounded / 60)}h ${rest}m`;
}

export interface SessionListItemProps {
    session: TrainingSession;
    coachName?: string;
    /** Staff views: show whose session it is. */
    fighter?: FighterIdentityData;
    /** Makes the whole item a link to the session. */
    href?: string;
    /** Dense variant for agendas: no date block, fewer details. */
    compact?: boolean;
    /** Show the calendar tile. Turn off when a surrounding heading already names the day. */
    showDate?: boolean;
    className?: string;
}

/** A training session row: date, time, type, duration, coach, target RPE and status. */
export function SessionListItem({ session, coachName, fighter, href, compact = false, showDate = true, className }: SessionListItemProps) {
    const inactive = session.status === "cancelled" || session.status === "missed";
    const title = href ? (
        <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] hover:underline">
            {session.title}
        </Link>
    ) : (
        session.title
    );

    if (compact) {
        return (
            <div
                className={cn(
                    "relative flex flex-col gap-1 rounded-lg border border-border bg-surface p-2.5 text-xs",
                    href && "transition-colors hover:border-border-strong hover:bg-surface-muted",
                    className,
                )}
            >
                <p className="flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
                    <TrainingTypeIcon type={session.type} labelled className="size-3.5 shrink-0" />
                    <time dateTime={session.scheduledAt} className="font-medium text-fg">
                        {formatTime(session.scheduledAt)}
                    </time>
                    <span aria-hidden>·</span>
                    <span aria-hidden>{shortDuration(session.durationMin)}</span>
                    <span className="sr-only">{formatMinutes(session.durationMin)}</span>
                </p>
                <p className={cn("line-clamp-2 text-[13px] leading-snug font-medium", inactive ? "text-fg-muted" : "text-fg")}>{title}</p>
                {fighter && (
                    <p className="flex min-w-0 items-center gap-1.5 text-fg-muted">
                        <Avatar name={fighter.name} shape="octagon" size="xs" />
                        <span className="truncate">{fighter.name}</span>
                    </p>
                )}
                {session.status !== "scheduled" && <SessionStatusBadge status={session.status} size="sm" className="self-start" />}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "relative flex items-start gap-4 px-4 py-3",
                href && "transition-colors hover:bg-surface-muted/60",
                className,
            )}
        >
            {showDate && <DateBlock date={session.scheduledAt} />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {fighter && <FighterIdentity fighter={fighter} size="sm" showMeta={false} className="mb-0.5" />}
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className={cn("min-w-0 text-sm font-semibold", inactive ? "text-fg-muted" : "text-fg")}>{title}</p>
                    <SessionStatusBadge status={session.status} size="sm" />
                </div>
                <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                    <li className="inline-flex items-center gap-1.5">
                        <TrainingTypeIcon type={session.type} className="size-3.5 text-fg-subtle" />
                        {TRAINING_TYPE_LABELS[session.type]}
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                        <Clock aria-hidden className="size-3.5 text-fg-subtle" />
                        <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt)}</time>
                        <span aria-hidden>·</span>
                        {formatMinutes(session.durationMin)}
                    </li>
                    {coachName && (
                        <li className="inline-flex items-center gap-1.5">
                            <UserRound aria-hidden className="size-3.5 text-fg-subtle" />
                            <span className="sr-only">Coach </span>
                            {coachName}
                        </li>
                    )}
                    <li className="inline-flex items-center gap-1.5">
                        <Gauge aria-hidden className="size-3.5 text-fg-subtle" />
                        Target RPE {session.targetRpe}
                    </li>
                </ul>
            </div>
        </div>
    );
}
