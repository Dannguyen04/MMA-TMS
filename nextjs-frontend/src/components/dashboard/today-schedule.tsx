import { CalendarPlus, CalendarRange } from "lucide-react";
import Link from "next/link";

import { ClearanceBadge, SessionStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { ClearanceState } from "@/lib/domain/rules";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

export interface TodayScheduleProps {
    /** Today's roster sessions, earliest first. */
    sessions: TrainingSession[];
    fighters: Record<string, { name: string; clearanceState: ClearanceState }>;
    /** The viewer's language; English when omitted. */
    t?: Translator;
    locale?: Locale;
    className?: string;
}

/** Every session on today's roster calendar: time, who, what, status and the fighter's clearance. */
export function TodaySchedule({ sessions, fighters, t = createTranslator("en"), locale, className }: TodayScheduleProps) {
    const active = sessions.filter((session) => session.status !== "cancelled").length;

    return (
        <Card className={cn("flex min-w-0 flex-col", className)}>
            <CardHeader
                title={t("schedule.title")}
                description={
                    sessions.length === 0
                        ? t("schedule.nothing")
                        : [t("schedule.planned", { n: active }), active === sessions.length ? null : t("schedule.cancelled", { n: sessions.length - active })].filter(Boolean).join(" · ")
                }
                icon={<CalendarRange />}
                action={<CardLink href={routes.coach.sessions}>{t("schedule.week")}</CardLink>}
            />
            {sessions.length === 0 ? (
                <EmptyState
                    compact
                    icon={<CalendarRange />}
                    title={t("schedule.emptyTitle")}
                    description={t("schedule.emptyText")}
                    action={
                        <ButtonLink href={routes.coach.newSession} variant="secondary" size="sm">
                            <CalendarPlus aria-hidden />
                            {t("coachToday.scheduleSession")}
                        </ButtonLink>
                    }
                    className="flex-1 pt-2"
                />
            ) : (
                <ol className="flex flex-col divide-y divide-border border-t border-border">
                    {sessions.map((session) => {
                        const fighter = fighters[session.fighterId];
                        const inactive = session.status === "cancelled" || session.status === "missed";
                        return (
                            <li key={session.id} className="relative flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50">
                                <p className="w-12 shrink-0 pt-0.5 leading-tight">
                                    <time dateTime={session.scheduledAt} className={cn("block text-sm font-semibold tabular-nums", inactive ? "text-fg-muted" : "text-fg")}>
                                        {formatTime(session.scheduledAt)}
                                    </time>
                                    {session.durationMin !== null && <span className="block text-[11px] text-fg-subtle">{formatMinutes(session.durationMin, locale)}</span>}
                                </p>
                                <div className="min-w-0 flex-1">
                                    <p className={cn("text-sm font-medium", inactive ? "text-fg-muted" : "text-fg")}>
                                        <Link
                                            href={routes.coach.session(session.id)}
                                            className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline"
                                        >
                                            {session.title}
                                        </Link>
                                    </p>
                                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-fg-muted">
                                        {fighter && (
                                            <>
                                                <Avatar name={fighter.name} shape="octagon" size="xs" />
                                                <span className="truncate font-medium text-fg">{fighter.name}</span>
                                                <span aria-hidden>·</span>
                                            </>
                                        )}
                                        <TrainingTypeIcon type={session.type} className="size-3.5 text-fg-subtle" />
                                        <span className="truncate">{t(`trainingType.${session.type}`)}</span>
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        <SessionStatusBadge status={session.status} size="sm" locale={locale} />
                                        {fighter && <ClearanceBadge state={fighter.clearanceState} size="sm" locale={locale} />}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Card>
    );
}
