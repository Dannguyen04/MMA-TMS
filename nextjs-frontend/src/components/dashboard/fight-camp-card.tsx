import { CalendarOff, CircleCheck, ClipboardList, Scale, Trophy } from "lucide-react";
import Link from "next/link";

import { TechniqueChips } from "@/components/domain/technique-chip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { PlanAdherence } from "@/lib/domain/training-plan";
import type { TrainingPlan, UpcomingBout, WeightClass } from "@/lib/domain/types";
import { daysBetween, formatNumber, formatPercent, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
import { clamp, cn } from "@/lib/utils";
import { weightCheck, weightGapText, type WeightCheck } from "./dashboard-utils";

const DAY_MS = 86_400_000;
/** Camp length assumed when there is no fight-camp plan to date it from. */
const DEFAULT_CAMP_DAYS = 56;
/** Fight week starts this many days before the bout. */
const FIGHT_WEEK_DAYS = 6;

/** The fight-camp plan preparing this bout, folded into the card instead of a separate plan card. */
export interface FightCampPlan {
    plan: Pick<TrainingPlan, "title" | "weeklySessionTarget" | "focusAreas">;
    href: string;
    adherence: PlanAdherence | null;
}

export interface FightCampCardProps {
    bout: UpcomingBout | null;
    weightKg: number;
    /** Fighter's own class, used when no bout is booked. */
    weightClass: WeightClass;
    /** Start of the active fight-camp plan, if there is one. */
    campStart: string | null;
    /** The camp plan's weekly target, adherence and focus, when that plan is preparing this bout. */
    campPlan?: FightCampPlan;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/** Fight camp at a glance: event, opponent, countdown from camp start, and weight against the class limit. */
export function FightCampCard({ bout, weightKg, weightClass, campStart, campPlan, now, className }: FightCampCardProps) {
    if (!bout) {
        const check = weightCheck(weightKg, weightClass);
        return (
            <Card className={cn("flex min-w-0 flex-col", className)}>
                <CardHeader title="Next bout" icon={<Trophy />} />
                <CardContent className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-6 text-center">
                        <span aria-hidden className="octagon flex size-10 items-center justify-center bg-surface-muted text-fg-subtle">
                            <CalendarOff className="size-5" />
                        </span>
                        <p className="text-sm font-semibold text-fg">No bout scheduled</p>
                        <p className="max-w-xs text-sm text-pretty text-fg-muted">
                            When your coach books a bout, the camp countdown and your weight target appear here.
                        </p>
                    </div>
                    <WeightPanel check={check} weightClass={weightClass} note={check.onWeight ? "Within your class limit." : "Your walk-around weight is above the class limit — normal outside camp."} />
                </CardContent>
            </Card>
        );
    }

    const daysToGo = Math.max(0, daysBetween(now, bout.date));
    const start = campStart ?? new Date(Date.parse(bout.date) - DEFAULT_CAMP_DAYS * DAY_MS).toISOString();
    const campDays = Math.max(1, daysBetween(start, bout.date));
    const campDay = clamp(daysBetween(start, now) + 1, 0, campDays);
    const fightWeek = new Date(Date.parse(bout.date) - FIGHT_WEEK_DAYS * DAY_MS).toISOString();
    const check = weightCheck(weightKg, bout.weightClass, daysToGo);
    const campPrefix = campStart ? "Camp day" : "Est. camp day";

    return (
        <Card className={cn("flex min-w-0 flex-col", className)}>
            <CardHeader title="Fight camp" icon={<Trophy />} />
            <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[15px] leading-snug font-semibold text-fg">{bout.event}</p>
                        <p className="mt-0.5 text-[13px] text-fg-muted">
                            vs {bout.opponent} · <time dateTime={bout.date}>{formatWeekdayDate(bout.date)}</time>
                        </p>
                    </div>
                    <p className="shrink-0 text-right leading-none">
                        <span className="block text-[32px] font-semibold tracking-tight text-fg">{daysToGo}</span>
                        <span className="mt-1 block text-xs text-fg-muted">{daysToGo === 1 ? "day to go" : "days to go"}</span>
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <ProgressBar
                        value={campDay}
                        max={campDays}
                        size="sm"
                        label="Fight camp progress"
                        valueText={campDay > 0 ? `${campPrefix} ${campDay} of ${campDays}` : `Camp starts in ${pluralize(-daysBetween(start, now), "day")}`}
                    />
                    <ol className="grid grid-cols-3 gap-2 text-center">
                        <Milestone label={campStart ? "Camp start" : "Camp start (est.)"} date={start} now={now} />
                        <Milestone label="Fight week" date={fightWeek} now={now} />
                        <Milestone label="Fight night" date={bout.date} now={now} />
                    </ol>
                </div>

                {campPlan && <CampPlanSummary {...campPlan} />}

                <WeightPanel check={check} weightClass={bout.weightClass} note={cutNote(check, daysToGo)} className="mt-auto" />
            </CardContent>
        </Card>
    );
}

function CampPlanSummary({ plan, href, adherence }: FightCampPlan) {
    return (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
            <p className="flex min-w-0 items-center gap-1.5 text-[13px]">
                <ClipboardList aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                <span className="sr-only">Camp plan: </span>
                <Link href={href} className="truncate rounded-sm font-medium text-fg hover:underline">
                    {plan.title}
                </Link>
            </p>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="min-w-0">
                    <dt className="text-fg-muted">Weekly target</dt>
                    <dd className="mt-0.5 font-medium text-fg">{pluralize(plan.weeklySessionTarget, "session")}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-fg-muted">Adherence</dt>
                    <dd className="mt-0.5 font-medium text-fg">
                        {adherence ? formatPercent(adherence.pct) : "—"}
                        <span className="ml-1 font-normal text-fg-muted">{adherence ? `${adherence.completed} of ${adherence.due} due` : "nothing due yet"}</span>
                    </dd>
                </div>
            </dl>
            <TechniqueChips techniques={plan.focusAreas} label="Camp focus areas" size="sm" />
        </div>
    );
}

function Milestone({ label, date, now }: { label: string; date: string; now: string }) {
    const passed = daysBetween(now, date) < 0;
    return (
        <li className="min-w-0 rounded-lg border border-border px-2 py-2">
            <p className="flex items-center justify-center gap-1 text-[11px] font-medium text-fg-muted">
                {passed && <CircleCheck aria-hidden className="size-3 shrink-0 text-success-fg" />}
                <span className="truncate">{label}</span>
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-fg">
                <time dateTime={date}>{formatShortDate(date)}</time>
                <span className="sr-only">{passed ? " (passed)" : ""}</span>
            </p>
        </li>
    );
}

function cutNote(check: WeightCheck, daysToGo: number): string {
    if (check.onWeight) return "You're on weight. Keep your walk-around weight steady through camp.";
    if (check.pacePerWeek === null) return "Weigh-in is close — follow the plan your coach and sports doctor agreed.";
    const pace = `about ${formatNumber(check.pacePerWeek, 1)} kg a week over ${pluralize(daysToGo, "day")}`;
    return check.fastPace
        ? `That's ${pace}. Plan the cut with your coach and sports doctor so it stays safe.`
        : `That's ${pace} — a steady pace. Stick to your nutrition plan.`;
}

function WeightPanel({ check, weightClass, note, className }: { check: WeightCheck; weightClass: WeightClass; note: string; className?: string }) {
    return (
        <div className={cn("rounded-lg bg-surface-muted px-3.5 py-3", className)}>
            <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                    <Scale aria-hidden className="size-3.5 text-fg-subtle" />
                    Weight
                </p>
                <p className="text-right text-[13px] text-fg-muted">
                    {WEIGHT_CLASS_LABELS[weightClass]} limit {formatNumber(check.limitKg, 1)} kg
                </p>
            </div>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-xl font-semibold text-fg">{formatNumber(check.currentKg, 1)} kg</span>
                <span className={cn("text-sm font-medium", check.onWeight ? "text-success-fg" : check.fastPace ? "text-warning-fg" : "text-fg")}>
                    {weightGapText(check)}
                </span>
            </p>
            <p className="mt-1 text-[13px] text-pretty text-fg-muted">{note}</p>
        </div>
    );
}
