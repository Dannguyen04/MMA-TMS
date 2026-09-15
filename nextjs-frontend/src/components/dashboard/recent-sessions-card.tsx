import { History } from "lucide-react";
import Link from "next/link";

import { CoachRating } from "@/components/domain/coach-rating";
import { SessionStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { TrainingSession } from "@/lib/domain/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";
import { relativeDay } from "./dashboard-utils";

export interface RecentSessionsCardProps {
    sessions: TrainingSession[];
    sessionHref: (sessionId: string) => string;
    historyHref: string;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/** The fighter's latest finished sessions with reported RPE and the coach's rating. Server Component. */
export function RecentSessionsCard({ sessions, sessionHref, historyHref, now, className }: RecentSessionsCardProps) {
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Recent results" icon={<History />} action={<CardLink href={historyHref}>History</CardLink>} />
            {sessions.length === 0 ? (
                <EmptyState compact icon={<History />} title="No finished sessions yet" description="Results and coach ratings appear after each session." className="pt-0" />
            ) : (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {sessions.map((session) => (
                        <li key={session.id} className="relative flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50">
                            <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                                <TrainingTypeIcon type={session.type} className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-fg">
                                    <Link href={sessionHref(session.id)} className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline">
                                        {session.title}
                                    </Link>
                                </p>
                                <p className="mt-0.5 text-xs text-fg-muted">
                                    {relativeDay(session.scheduledAt, now)} · <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt)}</time>
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    {session.result ? (
                                        <>
                                            <span className="text-xs font-medium text-fg">RPE {session.result.rpe}</span>
                                            <CoachRating rating={session.result.coachRating} compact />
                                        </>
                                    ) : (
                                        <SessionStatusBadge status={session.status} size="sm" />
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
