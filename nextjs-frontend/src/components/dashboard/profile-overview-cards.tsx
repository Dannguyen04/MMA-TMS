import { CalendarDays, Ruler, ShieldAlert, ShieldX, Target } from "lucide-react";

import { SessionListItem } from "@/components/domain/session-list-item";
import { GoalStatusBadge } from "@/components/domain/status-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { WEIGHT_CLASS_LIMIT_KG, stanceLabel, weightClassLabel } from "@/lib/domain/labels";
import { goalProgressPct } from "@/lib/domain/rules";
import type { Fighter, Goal } from "@/lib/domain/types";
import { ageFromBirthDate, daysBetween, formatDate, formatNumber, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";
import { weightCheck, weightGapText } from "./dashboard-utils";
import type { SessionCheck } from "./roster-data";

/* ─── Body & fight profile ────────────────────────────────────────────────── */

export function BodyProfileCard({ fighter, now, className, locale = "en" }: { fighter: Fighter; now: string; className?: string; locale?: Locale }) {
    const t = createTranslator(locale);
    const notRecorded = t("screens.roster.notRecorded");
    const bout = fighter.upcomingBout;
    const weightClass = bout?.weightClass ?? fighter.weightClass;
    const check = fighter.weightKg === null ? null : weightCheck(fighter.weightKg, weightClass, bout ? Math.max(0, daysBetween(now, bout.date)) : null);

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title={t("screens.roster.body.title")} icon={<Ruler />} />
            <CardContent className="flex flex-col gap-5">
                <div className="rounded-lg bg-surface-muted px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-[13px] text-fg-muted">
                            {t(bout ? "screens.roster.body.weightVsLimitNextBout" : "screens.roster.body.weightVsLimit", {
                                weightClass: weightClassLabel(weightClass, locale),
                            })}
                        </p>
                        {check && (
                            <p className={cn("text-sm font-medium", check.onWeight ? "text-success-fg" : check.fastPace ? "text-warning-fg" : "text-fg")}>
                                {weightGapText(check, t)}
                                {check.pacePerWeek !== null && (
                                    <span className="font-normal text-fg-muted"> · ~{t("screens.roster.body.pacePerWeek", { kg: formatNumber(check.pacePerWeek, 1) })}</span>
                                )}
                            </p>
                        )}
                    </div>
                    <p className="mt-1 flex items-baseline gap-2">
                        <span className="text-xl font-semibold text-fg">{check ? `${formatNumber(check.currentKg, 1)} kg` : notRecorded}</span>
                        <span className="text-[13px] text-fg-muted">{t("screens.roster.body.limit", { kg: formatNumber(WEIGHT_CLASS_LIMIT_KG[weightClass], 1) })}</span>
                    </p>
                </div>
                <DescriptionList
                    columns={3}
                    items={[
                        { label: t("screens.roster.body.height"), value: fighter.heightCm === null ? notRecorded : `${fighter.heightCm} cm` },
                        { label: t("screens.roster.body.reach"), value: fighter.reachCm === null ? notRecorded : `${fighter.reachCm} cm` },
                        { label: t("screens.roster.body.bodyFat"), value: fighter.bodyFatPct === null ? notRecorded : `${formatNumber(fighter.bodyFatPct, 1)}%` },
                        { label: t("screens.roster.body.restingHeartRate"), value: fighter.restingHeartRate === null ? notRecorded : `${fighter.restingHeartRate} bpm` },
                        { label: t("screens.roster.body.stance"), value: fighter.stance === null ? notRecorded : stanceLabel(fighter.stance, locale) },
                        { label: t("screens.roster.body.age"), value: t("screens.roster.body.ageYears", { n: ageFromBirthDate(fighter.dateOfBirth, now) }) },
                        { label: t("screens.roster.body.nationality"), value: fighter.nationality },
                        { label: t("screens.roster.body.discipline"), value: fighter.primaryDiscipline },
                        {
                            label: t("screens.roster.body.joined"),
                            value: (
                                <span className="flex flex-col gap-0.5">
                                    <time dateTime={fighter.joinedAt}>{formatDate(fighter.joinedAt, locale)}</time>
                                    <span className="text-[13px] font-normal text-fg-muted">{formatRelative(fighter.joinedAt, now, locale)}</span>
                                </span>
                            ),
                        },
                    ]}
                />
            </CardContent>
        </Card>
    );
}

/* ─── Upcoming sessions ───────────────────────────────────────────────────── */

export interface UpcomingSessionsCardProps {
    checks: SessionCheck[];
    coachNames: Map<string, string>;
    sessionHref: (sessionId: string) => string;
    allHref: string;
    /** Why nothing is scheduled, e.g. training paused while Not Cleared. */
    emptyDescription?: string;
    className?: string;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}

/** Next sessions with any Medical Clearance conflict spelled out under each one. */
export function UpcomingSessionsCard({ checks, coachNames, sessionHref, allHref, emptyDescription, className, locale = "en" }: UpcomingSessionsCardProps) {
    const t = createTranslator(locale);
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title={t("screens.roster.sessions.title")} icon={<CalendarDays />} action={<CardLink href={allHref}>{t("screens.roster.sessions.all")}</CardLink>} />
            {checks.length === 0 ? (
                <EmptyState
                    compact
                    icon={<CalendarDays />}
                    title={t("screens.roster.sessions.emptyTitle")}
                    description={emptyDescription ?? t("screens.roster.sessions.emptyDesc")}
                    className="pt-0"
                />
            ) : (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {checks.map(({ session, conflicts }) => {
                        const blocking = conflicts.find((conflict) => conflict.severity === "block");
                        const shown = blocking ?? conflicts[0];
                        return (
                            <li key={session.id}>
                                <SessionListItem session={session} coachName={session.coachId ? coachNames.get(session.coachId) : undefined} href={sessionHref(session.id)} locale={locale} className="px-5!" />
                                {shown && (
                                    <p
                                        className={cn(
                                            "-mt-1 flex items-start gap-1.5 pr-5 pb-3 pl-[5.25rem] text-[13px] text-pretty",
                                            blocking ? "text-danger-fg" : "text-warning-fg",
                                        )}
                                    >
                                        {blocking ? <ShieldX aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                                        <span>
                                            <span className="font-medium">{t(blocking ? "screens.roster.sessions.conflicts" : "screens.roster.sessions.check")}</span>
                                            {shown.message}
                                            {conflicts.length > 1 && ` ${t("screens.roster.sessions.moreConflicts", { n: conflicts.length - 1 })}`}
                                        </span>
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}

/* ─── Goals snapshot ──────────────────────────────────────────────────────── */

const GOALS_SHOWN = 3;

export function GoalsSnapshotCard({ goals, href, className, locale = "en" }: { goals: Goal[]; href: string; className?: string; locale?: Locale }) {
    const t = createTranslator(locale);
    const open = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const counts = {
        onTrack: goals.filter((goal) => goal.status === "on_track").length,
        atRisk: goals.filter((goal) => goal.status === "at_risk").length,
        achieved: goals.filter((goal) => goal.status === "achieved").length,
    };

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title={t("screens.roster.goals.title")} icon={<Target />} action={<CardLink href={href}>{t("screens.roster.goals.all")}</CardLink>} />
            <CardContent className="flex flex-col gap-4">
                {goals.length === 0 ? (
                    <EmptyState compact icon={<Target />} title={t("screens.roster.goals.emptyTitle")} description={t("screens.roster.goals.emptyDesc")} className="py-4" />
                ) : (
                    <>
                        <dl className="grid grid-cols-3 gap-2 text-center">
                            {[
                                { label: t("screens.roster.goals.onTrack"), value: counts.onTrack },
                                { label: t("screens.roster.goals.atRisk"), value: counts.atRisk },
                                { label: t("screens.roster.goals.achieved"), value: counts.achieved },
                            ].map((item) => (
                                <div key={item.label} className="rounded-lg bg-surface-muted px-2 py-2">
                                    <dt className="text-xs text-fg-muted">{item.label}</dt>
                                    <dd className="text-lg leading-tight font-semibold text-fg">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                        {open.length > 0 ? (
                            <ul className="flex flex-col gap-3">
                                {open.slice(0, GOALS_SHOWN).map((goal) => {
                                    const progress = goalProgressPct(goal);
                                    return (
                                        <li key={goal.id} className="min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="min-w-0 text-sm leading-snug font-medium text-fg">{goal.title}</p>
                                                <GoalStatusBadge status={goal.status} size="sm" locale={locale} className="shrink-0" />
                                            </div>
                                            <ProgressBar
                                                value={progress}
                                                size="sm"
                                                label={t("screens.roster.goals.progressLabel", { title: goal.title })}
                                                valueText={t("screens.roster.goals.progressValue", { pct: progress, date: formatDate(goal.dueDate, locale) })}
                                                className="mt-1.5"
                                            />
                                        </li>
                                    );
                                })}
                                {open.length > GOALS_SHOWN && <li className="text-[13px] text-fg-muted">{plural(t, "screens.roster.goals.moreOpen", open.length - GOALS_SHOWN)}</li>}
                            </ul>
                        ) : (
                            <p className="text-sm text-fg-muted">{t("screens.roster.goals.noOpen")}</p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
