import { CalendarClock, CalendarOff, Gauge, ListChecks, MapPin, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SessionStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { rpeLabel } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes, formatTime, formatWeekdayDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";
import { relativeDay } from "./dashboard-utils";

const MINUTE_MS = 60_000;

export interface NextSessionCardProps {
    session: TrainingSession | null;
    coachName?: string;
    sessionHref: string | null;
    scheduleHref: string;
    /** Server time (ISO). */
    now: string;
    /** Short note under the details, e.g. that sessions can't be checked against a clearance yet. */
    note?: ReactNode;
    className?: string;
}

/** Fighter hero: the next session with when, where, who and how hard. */
export function NextSessionCard({ session, coachName, sessionHref, scheduleHref, now, note, className }: NextSessionCardProps) {
    return (
        <Card className={cn("flex min-w-0 flex-col overflow-hidden", className)}>
            <div aria-hidden className="h-1 bg-primary" />
            <CardHeader title="Next session" icon={<CalendarClock />} action={<CardLink href={scheduleHref}>Schedule</CardLink>} />
            <CardContent className="flex flex-1 flex-col gap-4">
                {session ? (
                    <SessionDetails session={session} coachName={coachName} sessionHref={sessionHref} now={now} note={note} />
                ) : (
                    <EmptyState
                        compact
                        icon={<CalendarOff />}
                        title="No sessions scheduled"
                        description="Your coach hasn't scheduled your next session yet. New sessions show up here and in your schedule."
                        className="flex-1"
                    />
                )}
            </CardContent>
        </Card>
    );
}

function SessionDetails({
    session,
    coachName,
    sessionHref,
    now,
    note,
}: {
    session: TrainingSession;
    coachName?: string;
    sessionHref: string | null;
    now: string;
    note?: ReactNode;
}) {
    const end = new Date(Date.parse(session.scheduledAt) + session.durationMin * MINUTE_MS).toISOString();
    const inProgress = session.status === "in_progress" || (Date.parse(session.scheduledAt) <= Date.parse(now) && Date.parse(end) > Date.parse(now));

    return (
        <>
            <div className="flex items-start gap-3.5">
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg ring-1 ring-primary/25 ring-inset"
                >
                    <TrainingTypeIcon type={session.type} className="size-6" />
                </span>
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-wide text-primary-soft-fg uppercase">
                        <span>
                            {inProgress ? "Happening now" : relativeDay(session.scheduledAt, now)} · <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt)}</time>
                        </span>
                        {session.status === "in_progress" && <SessionStatusBadge status={session.status} size="sm" />}
                    </p>
                    <h3 className="mt-1 text-lg leading-snug font-semibold text-pretty text-fg">
                        {sessionHref ? (
                            <Link href={sessionHref} className="rounded-sm hover:underline">
                                {session.title}
                            </Link>
                        ) : (
                            session.title
                        )}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                        {TRAINING_TYPE_LABELS[session.type]} · {formatWeekdayDate(session.scheduledAt)}, {formatTime(session.scheduledAt)}–{formatTime(end)}
                    </p>
                </div>
            </div>

            <dl className="grid grid-cols-2 gap-2">
                <Detail icon={MapPin} label="Location" value={session.location} />
                <Detail icon={UserRound} label="Coach" value={coachName ?? "To be confirmed"} />
                <Detail icon={Gauge} label="Target intensity" value={`RPE ${session.targetRpe} · ${rpeLabel(session.targetRpe)}`} />
                <Detail
                    icon={ListChecks}
                    label="Plan"
                    value={`${pluralize(session.exercises.length, "exercise")} · ${formatMinutes(session.durationMin)}`}
                />
            </dl>

            {note}

            {sessionHref && (
                <ButtonLink href={sessionHref} variant="secondary" className="mt-auto w-full">
                    Open session plan
                </ButtonLink>
            )}
        </>
    );
}

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-lg bg-surface-muted px-3 py-2">
            <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
                <Icon aria-hidden className="size-3.5 text-fg-subtle" />
                {label}
            </dt>
            <dd className="mt-0.5 text-sm leading-snug font-medium break-words text-fg">{value}</dd>
        </div>
    );
}
