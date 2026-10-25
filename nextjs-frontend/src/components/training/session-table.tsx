import type { Locale } from "@/lib/i18n/config";
import { PlayCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CoachRating } from "@/components/domain/coach-rating";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { SessionStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { SortableTH, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { trainingTypeLabel } from "@/lib/domain/labels";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes, formatTime, formatWeekdayDate } from "@/lib/format";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { SessionSortKey } from "./training-utils";

export type TrainingAudience = "fighter" | "coach";

export function sessionHref(audience: TrainingAudience, sessionId: string): string {
    return audience === "fighter" ? routes.fighter.session(sessionId) : routes.coach.session(sessionId);
}

export function videoHref(audience: TrainingAudience, videoId: string): string {
    return audience === "fighter" ? routes.fighter.video(videoId) : routes.coach.video(videoId);
}

export interface SessionTableSort {
    pathname: string;
    searchParams: SearchParams;
    sort: SessionSortKey;
    dir: SortDirection;
}

export interface SessionTableProps {
    locale?: Locale;
    sessions: TrainingSession[];
    audience: TrainingAudience;
    caption: string;
    fightersById?: Record<string, FighterIdentityData>;
    showFighter?: boolean;
    showVideo?: boolean;
    /** Makes headers sortable via ?sort=&dir=. */
    sort?: SessionTableSort;
    /** Below `md`, render stacked cards instead of a horizontally scrolling table. */
    stackOnMobile?: boolean;
}

const isUpcoming = (session: TrainingSession) => session.status === "scheduled" || session.status === "in_progress";

function NotRecorded({ label }: { label: string }) {
    return (
        <>
            <span aria-hidden className="text-fg-subtle">
                —
            </span>
            <span className="sr-only">{label}</span>
        </>
    );
}

function RpeValue({ session, t }: { session: TrainingSession; t: Translator }) {
    if (session.result?.rpe != null) return <span className="font-medium">{session.result.rpe}</span>;
    if (isUpcoming(session) && session.targetRpe !== null) {
        return <span className="text-fg-muted">{t("training.table.targetRpe", { rpe: session.targetRpe })}</span>;
    }
    return <NotRecorded label={t("training.table.notRecorded")} />;
}

function DurationValue({ session, t }: { session: TrainingSession; t: Translator }) {
    if (session.result?.actualDurationMin != null) return <>{formatMinutes(session.result.actualDurationMin)}</>;
    if (session.durationMin === null) return <NotRecorded label={t("training.table.notRecorded")} />;
    return <span className="text-fg-muted">{formatMinutes(session.durationMin)}</span>;
}

function VideoLink({ session, audience, t }: { session: TrainingSession; audience: TrainingAudience; t: Translator }) {
    const videoId = session.videoIds[0];
    if (!videoId) return <NotRecorded label={t("training.table.noVideo")} />;
    return (
        <Link
            href={videoHref(audience, videoId)}
            aria-label={t("training.table.watchVideo", { title: session.title })}
            className="relative z-10 inline-flex size-8 items-center justify-center rounded-md text-primary-soft-fg hover:bg-surface-hover"
        >
            <PlayCircle aria-hidden className="size-[18px]" />
        </Link>
    );
}

/** Sessions as a table (with optional sortable headers) and, optionally, stacked cards on small screens. */
export function SessionTable({
    locale = "en",
    sessions,
    audience,
    caption,
    fightersById,
    showFighter = false,
    showVideo = false,
    sort,
    stackOnMobile = false,
}: SessionTableProps) {
    const t = createTranslator(locale);
    // With a fighter column the table gets wide, so the type moves under the title.
    const typeColumn = !showFighter;
    const header = (key: SessionSortKey, label: string, className?: string): ReactNode =>
        sort ? (
            <SortableTH
                key={key}
                label={label}
                sortKey={key}
                pathname={sort.pathname}
                searchParams={sort.searchParams}
                activeSort={sort.sort}
                direction={sort.dir}
                className={className}
            />
        ) : (
            <TH key={key} className={className}>
                {label}
            </TH>
        );

    return (
        <>
            <div className={cn(stackOnMobile && "hidden md:block")}>
                <Table caption={caption} className="relative">
                    <THead>
                        <tr>
                            {header("date", t("training.table.date"))}
                            {header("title", t("training.table.session"))}
                            {showFighter && header("fighter", t("training.table.fighter"))}
                            {typeColumn && header("type", t("training.table.type"))}
                            {header("duration", t("training.table.duration"))}
                            {header("rpe", t("training.table.rpe"))}
                            {header("rating", t("training.table.coachRating"))}
                            {header("status", t("training.table.status"))}
                            {showVideo && <TH className="text-center">{t("training.table.video")}</TH>}
                        </tr>
                    </THead>
                    <TBody>
                        {sessions.map((session) => {
                            const fighter = fightersById?.[session.fighterId];
                            return (
                                <TR key={session.id}>
                                    <TD className="whitespace-nowrap">
                                        <time dateTime={session.scheduledAt} className="block font-medium">
                                            {formatWeekdayDate(session.scheduledAt, locale)}
                                        </time>
                                        <span className="text-xs text-fg-muted">{formatTime(session.scheduledAt, locale)}</span>
                                    </TD>
                                    <TD className="min-w-48">
                                        <Link
                                            href={sessionHref(audience, session.id)}
                                            className={cn(
                                                "rounded-sm font-medium hover:underline",
                                                session.status === "cancelled" || session.status === "missed" ? "text-fg-muted" : "text-fg",
                                            )}
                                        >
                                            {session.title}
                                        </Link>
                                        {!typeColumn && (
                                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                                                <TrainingTypeIcon type={session.type} locale={locale} className="size-3.5 text-fg-subtle" />
                                                {trainingTypeLabel(t, session.type)}
                                            </span>
                                        )}
                                    </TD>
                                    {showFighter && (
                                        <TD className="min-w-44">
                                            {fighter ? (
                                                <FighterIdentity fighter={fighter} size="sm" showMeta={false} />
                                            ) : (
                                                <NotRecorded label={t("training.table.unknownFighter")} />
                                            )}
                                        </TD>
                                    )}
                                    {typeColumn && (
                                        <TD className="whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                                <TrainingTypeIcon type={session.type} locale={locale} className="size-3.5 text-fg-subtle" />
                                                {trainingTypeLabel(t, session.type)}
                                            </span>
                                        </TD>
                                    )}
                                    <TD className="whitespace-nowrap">
                                        <DurationValue session={session} t={t} />
                                    </TD>
                                    <TD className="whitespace-nowrap">
                                        <RpeValue session={session} t={t} />
                                    </TD>
                                    <TD>
                                        {session.result?.coachRating != null ? (
                                            <CoachRating rating={session.result.coachRating} compact locale={locale} />
                                        ) : (
                                            <NotRecorded label={t("training.table.notRecorded")} />
                                        )}
                                    </TD>
                                    <TD>
                                        <SessionStatusBadge status={session.status} size="sm" locale={locale} />
                                    </TD>
                                    {showVideo && (
                                        <TD className="text-center">
                                            <VideoLink session={session} audience={audience} t={t} />
                                        </TD>
                                    )}
                                </TR>
                            );
                        })}
                    </TBody>
                </Table>
            </div>

            {stackOnMobile && (
                <ul aria-label={caption} className="divide-y divide-border md:hidden">
                    {sessions.map((session) => {
                        const fighter = fightersById?.[session.fighterId];
                        return (
                            <li key={session.id} className="relative flex flex-col gap-1.5 px-4 py-3.5 hover:bg-surface-muted/50">
                                <div className="flex items-start justify-between gap-3">
                                    <Link
                                        href={sessionHref(audience, session.id)}
                                        className="min-w-0 rounded-sm text-sm font-semibold text-fg after:absolute after:inset-0 after:content-[''] hover:underline"
                                    >
                                        {session.title}
                                    </Link>
                                    <SessionStatusBadge status={session.status} size="sm" className="shrink-0" locale={locale} />
                                </div>
                                <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-fg-muted">
                                    <time dateTime={session.scheduledAt}>
                                        {formatWeekdayDate(session.scheduledAt, locale)} · {formatTime(session.scheduledAt, locale)}
                                    </time>
                                    <span aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <TrainingTypeIcon type={session.type} locale={locale} className="size-3.5 text-fg-subtle" />
                                        {trainingTypeLabel(t, session.type)}
                                    </span>
                                </p>
                                {showFighter && fighter && <p className="truncate text-[13px] text-fg-muted">{fighter.name}</p>}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                                        <div className="flex gap-1">
                                            <dt className="text-fg-muted">{t("training.table.duration")}</dt>
                                            <dd className="font-medium text-fg">
                                                <DurationValue session={session} t={t} />
                                            </dd>
                                        </div>
                                        <div className="flex gap-1">
                                            <dt className="text-fg-muted">{t("training.table.rpe")}</dt>
                                            <dd className="text-fg">
                                                <RpeValue session={session} t={t} />
                                            </dd>
                                        </div>
                                        {session.result?.coachRating != null && (
                                            <div className="flex items-center gap-1">
                                                <dt className="sr-only">{t("training.table.coachRating")}</dt>
                                                <dd>
                                                    <CoachRating rating={session.result.coachRating} compact locale={locale} />
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                    {showVideo && session.videoIds.length > 0 && <VideoLink session={session} audience={audience} t={t} />}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
