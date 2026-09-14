import { CalendarDays, Ruler, ShieldAlert, ShieldX, Target } from "lucide-react";

import { SessionListItem } from "@/components/domain/session-list-item";
import { GoalStatusBadge } from "@/components/domain/status-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { STANCE_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { goalProgressPct } from "@/lib/domain/rules";
import type { Fighter, Goal } from "@/lib/domain/types";
import { ageFromBirthDate, daysBetween, formatDate, formatNumber, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";
import { weightCheck, weightGapText } from "./dashboard-utils";
import type { SessionCheck } from "./roster-data";

/* ─── Body & fight profile ────────────────────────────────────────────────── */

export function BodyProfileCard({ fighter, now, className }: { fighter: Fighter; now: string; className?: string }) {
    const bout = fighter.upcomingBout;
    const check = weightCheck(fighter.weightKg, bout?.weightClass ?? fighter.weightClass, bout ? Math.max(0, daysBetween(now, bout.date)) : null);

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Body & fight profile" icon={<Ruler />} />
            <CardContent className="flex flex-col gap-5">
                <div className="rounded-lg bg-surface-muted px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-[13px] text-fg-muted">
                            Weight vs {WEIGHT_CLASS_LABELS[bout?.weightClass ?? fighter.weightClass]} limit
                            {bout ? " for the next bout" : ""}
                        </p>
                        <p className={cn("text-sm font-medium", check.onWeight ? "text-success-fg" : check.fastPace ? "text-warning-fg" : "text-fg")}>
                            {weightGapText(check)}
                            {check.pacePerWeek !== null && (
                                <span className="font-normal text-fg-muted"> · ~{formatNumber(check.pacePerWeek, 1)} kg/week</span>
                            )}
                        </p>
                    </div>
                    <p className="mt-1 flex items-baseline gap-2">
                        <span className="text-xl font-semibold text-fg">{formatNumber(check.currentKg, 1)} kg</span>
                        <span className="text-[13px] text-fg-muted">limit {formatNumber(check.limitKg, 1)} kg</span>
                    </p>
                </div>
                <DescriptionList
                    columns={3}
                    items={[
                        { label: "Height", value: `${fighter.heightCm} cm` },
                        { label: "Reach", value: `${fighter.reachCm} cm` },
                        { label: "Body fat", value: `${formatNumber(fighter.bodyFatPct, 1)}%` },
                        { label: "Resting heart rate", value: `${fighter.restingHeartRate} bpm` },
                        { label: "Stance", value: STANCE_LABELS[fighter.stance] },
                        { label: "Age", value: `${ageFromBirthDate(fighter.dateOfBirth, now)} years` },
                        { label: "Nationality", value: fighter.nationality },
                        { label: "Discipline", value: fighter.primaryDiscipline },
                        {
                            label: "Joined",
                            value: (
                                <span className="flex flex-col gap-0.5">
                                    <time dateTime={fighter.joinedAt}>{formatDate(fighter.joinedAt)}</time>
                                    <span className="text-[13px] font-normal text-fg-muted">{formatRelative(fighter.joinedAt, now)}</span>
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
}

/** Next sessions with any Medical Clearance conflict spelled out under each one. */
export function UpcomingSessionsCard({ checks, coachNames, sessionHref, allHref, emptyDescription, className }: UpcomingSessionsCardProps) {
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Upcoming sessions" icon={<CalendarDays />} action={<CardLink href={allHref}>All sessions</CardLink>} />
            {checks.length === 0 ? (
                <EmptyState
                    compact
                    icon={<CalendarDays />}
                    title="Nothing scheduled"
                    description={emptyDescription ?? "No sessions in the next two weeks. Schedule one from the header above."}
                    className="pt-0"
                />
            ) : (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {checks.map(({ session, conflicts }) => {
                        const blocking = conflicts.find((conflict) => conflict.severity === "block");
                        const shown = blocking ?? conflicts[0];
                        return (
                            <li key={session.id}>
                                <SessionListItem session={session} coachName={coachNames.get(session.coachId)} href={sessionHref(session.id)} className="px-5!" />
                                {shown && (
                                    <p
                                        className={cn(
                                            "-mt-1 flex items-start gap-1.5 pr-5 pb-3 pl-[5.25rem] text-[13px] text-pretty",
                                            blocking ? "text-danger-fg" : "text-warning-fg",
                                        )}
                                    >
                                        {blocking ? <ShieldX aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                                        <span>
                                            <span className="font-medium">{blocking ? "Conflicts with clearance: " : "Clearance check: "}</span>
                                            {shown.message}
                                            {conflicts.length > 1 && ` (+${conflicts.length - 1} more)`}
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

export function GoalsSnapshotCard({ goals, href, className }: { goals: Goal[]; href: string; className?: string }) {
    const open = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const counts = {
        onTrack: goals.filter((goal) => goal.status === "on_track").length,
        atRisk: goals.filter((goal) => goal.status === "at_risk").length,
        achieved: goals.filter((goal) => goal.status === "achieved").length,
    };

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Goals" icon={<Target />} action={<CardLink href={href}>All goals</CardLink>} />
            <CardContent className="flex flex-col gap-4">
                {goals.length === 0 ? (
                    <EmptyState compact icon={<Target />} title="No goals yet" description="Set a measurable goal from the Goals tab." className="py-4" />
                ) : (
                    <>
                        <dl className="grid grid-cols-3 gap-2 text-center">
                            {[
                                { label: "On track", value: counts.onTrack },
                                { label: "At risk", value: counts.atRisk },
                                { label: "Achieved", value: counts.achieved },
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
                                                <GoalStatusBadge status={goal.status} size="sm" className="shrink-0" />
                                            </div>
                                            <ProgressBar
                                                value={progress}
                                                size="sm"
                                                label={`Progress to target for ${goal.title}`}
                                                valueText={`${progress}% · due ${formatDate(goal.dueDate)}`}
                                                className="mt-1.5"
                                            />
                                        </li>
                                    );
                                })}
                                {open.length > GOALS_SHOWN && <li className="text-[13px] text-fg-muted">{pluralize(open.length - GOALS_SHOWN, "more open goal")}</li>}
                            </ul>
                        ) : (
                            <p className="text-sm text-fg-muted">No open goals — every goal is achieved or closed.</p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
