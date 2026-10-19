import { CalendarOff, ClipboardList, HeartPulse, ShieldX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { plannedEndMs, rpeText } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { CornerTag } from "@/components/ui/corner-tag";
import { TRAINING_PHASE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { TrainingPhase, TrainingSession } from "@/lib/domain/types";
import { formatPercent, formatShortDate, formatTime, formatWeekdayDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { relativeDay } from "./dashboard-utils";
import { campDayLabel, campTimeline } from "./fight-camp";

/** What the right half of the hero shows: the next session, why training is paused, or that nothing is booked. */
export type NextUp =
    | { kind: "session"; session: TrainingSession; coachName?: string; href: string; note?: ReactNode }
    | { kind: "paused"; reason: "not_cleared" | "expired"; doctorName?: string; followUpDate: string | null; healthHref: string }
    | { kind: "none"; scheduleHref: string };

/** The active training plan, shown as one line under the camp. */
export interface HeroPlan {
    title: string;
    href: string;
    phase: TrainingPhase;
    adherencePct: number | null;
}

/** The booked bout as the hero shows it; `detail` is the weight line, e.g. "60 kg" or "Lightweight". */
export interface HeroBout {
    event: string;
    opponent: string;
    /** Fight night (ISO). */
    date: string;
    detail: string;
}

export interface FightHeroProps {
    bout: HeroBout | null;
    /** Start of the fight-camp plan preparing this bout, if there is one. */
    campStart: string | null;
    plan: HeroPlan | null;
    next: NextUp;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/**
 * The fighter's Today hero: the fight-camp countdown on the blue-corner ground, and the one thing to do next.
 * Server Component.
 */
export function FightHero({ bout, campStart, plan, next, now, className }: FightHeroProps) {
    return (
        <section aria-label="Fight camp and next session" className={cn("grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]", className)}>
            <div className="relative isolate flex min-w-0 flex-col gap-4 px-6 py-6 text-white sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-tl cage-hatch bg-hero-bg" />
                {bout ? <Camp bout={bout} campStart={campStart} now={now} /> : <OffCamp plan={plan} />}
                {plan && <PlanLine plan={plan} />}
            </div>
            <div className="relative isolate flex min-w-0 flex-col gap-3.5 px-6 py-6 sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-br bg-surface" />
                <NextUpPanel next={next} now={now} />
            </div>
        </section>
    );
}

function Camp({ bout, campStart, now }: { bout: HeroBout; campStart: string | null; now: string }) {
    const timeline = campTimeline(bout, campStart, now);
    const label = campDayLabel(timeline);

    return (
        <>
            <CornerTag tone="stage">{label}</CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]">{bout.event}</h2>
                <p className="mt-1 text-[15px] text-white/85">
                    vs {bout.opponent} · <time dateTime={bout.date}>{formatWeekdayDate(bout.date)}</time> · {bout.detail}
                </p>
            </div>
            <p className="flex items-end gap-3">
                <span className="font-display text-[76px] leading-[0.8] font-extrabold tracking-tight tabular-nums italic sm:text-[88px]">{timeline.daysToGo}</span>
                <span className="pb-1 font-display text-[15px] leading-tight font-bold tracking-[0.1em] uppercase">
                    {timeline.daysToGo === 1 ? "day" : "days"} to
                    <br />
                    fight night
                </span>
            </p>
            <div>
                <div
                    role="progressbar"
                    aria-label="Fight camp progress"
                    aria-valuemin={0}
                    aria-valuemax={timeline.campDays}
                    aria-valuenow={timeline.campDay}
                    aria-valuetext={label}
                    className="relative h-1.5 bg-white/25"
                >
                    <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${timeline.progressPct}%` }} />
                    <span aria-hidden className="absolute -top-1 h-3.5 w-1 -skew-x-12 bg-belt-gold" style={{ left: `${timeline.fightWeekPct}%` }} />
                </div>
                <ol className="mt-2 grid grid-cols-3 gap-2 text-[12px] leading-tight text-white/85">
                    <Milestone label={timeline.estimatedStart ? "Camp start (est.)" : "Camp start"} date={timeline.start} />
                    <Milestone label="Fight week" date={timeline.fightWeek} className="text-center" />
                    <Milestone label="Fight night" date={bout.date} className="text-right" />
                </ol>
            </div>
        </>
    );
}

function Milestone({ label, date, className }: { label: string; date: string; className?: string }) {
    return (
        <li className={cn("min-w-0", className)}>
            {label}
            <time dateTime={date} className="mt-0.5 block font-display text-[15px] font-bold text-white">
                {formatShortDate(date)}
            </time>
        </li>
    );
}

function OffCamp({ plan }: { plan: HeroPlan | null }) {
    return (
        <>
            <CornerTag tone="stage">{plan ? `${TRAINING_PHASE_LABELS[plan.phase]} phase` : "Off camp"}</CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold italic sm:text-[34px]">No bout booked</h2>
                <p className="mt-1 max-w-md text-[15px] text-pretty text-white/85">
                    When your coach books a bout, the fight-camp countdown and your weight target start here.
                </p>
            </div>
        </>
    );
}

function PlanLine({ plan }: { plan: HeroPlan }) {
    return (
        <p className="mt-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/20 pt-3 text-[13px] text-white/85">
            <ClipboardList aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">Training plan: </span>
            <Link href={plan.href} className="min-w-0 rounded-sm font-medium text-white underline-offset-2 hover:underline">
                {plan.title}
            </Link>
            {plan.adherencePct !== null && <span>· {formatPercent(plan.adherencePct)} of due sessions done</span>}
        </p>
    );
}

const PAUSED_COPY: Record<"not_cleared" | "expired", { title: string; body: string }> = {
    not_cleared: {
        title: "Not medically cleared",
        body: "Your sports doctor has paused training while you recover. Rest, follow your recovery plan, and don't train until they clear you.",
    },
    expired: {
        title: "Clearance needs renewing",
        body: "Your Medical Clearance has lapsed. A sports doctor needs to renew it before you train again.",
    },
};

function NextUpPanel({ next, now }: { next: NextUp; now: string }) {
    if (next.kind === "paused") {
        const copy = PAUSED_COPY[next.reason];
        return (
            <>
                <CornerTag tone="red">
                    <ShieldX aria-hidden />
                    Training paused
                </CornerTag>
                <h2 className="text-[17px] leading-snug font-semibold text-fg">{copy.title}</h2>
                <p className="text-sm text-pretty text-fg-muted">{copy.body}</p>
                <p className="text-[13px] text-fg-muted">
                    Next check with your doctor:{" "}
                    {next.followUpDate ? (
                        <span className="font-medium text-fg">
                            <time dateTime={next.followUpDate}>{formatWeekdayDate(next.followUpDate)}</time>
                            {next.doctorName ? ` with ${next.doctorName}` : ""}
                        </span>
                    ) : (
                        "your doctor will arrange it"
                    )}
                </p>
                <ButtonLink href={next.healthHref} className="mt-auto w-fit">
                    <HeartPulse aria-hidden />
                    View health &amp; clearance
                </ButtonLink>
            </>
        );
    }

    if (next.kind === "none") {
        return (
            <>
                <CornerTag tone="neutral">
                    <CalendarOff aria-hidden />
                    Nothing scheduled
                </CornerTag>
                <h2 className="text-[17px] leading-snug font-semibold text-fg">No sessions scheduled</h2>
                <p className="text-sm text-pretty text-fg-muted">Your coach hasn&apos;t scheduled your next session yet. New sessions show up here and in your schedule.</p>
                <ButtonLink href={next.scheduleHref} variant="secondary" className="mt-auto w-fit">
                    View schedule
                </ButtonLink>
            </>
        );
    }

    const { session, coachName, href, note } = next;
    const end = session.durationMin === null ? null : new Date(plannedEndMs(session)).toISOString();
    const intensity = rpeText(session.targetRpe);
    const inProgress = session.status === "in_progress" || (Date.parse(session.scheduledAt) <= Date.parse(now) && plannedEndMs(session) > Date.parse(now));

    return (
        <>
            <CornerTag tone="blue">
                <span>
                    {inProgress ? "Happening now" : `Next up · ${relativeDay(session.scheduledAt, now)}`} ·{" "}
                    <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt)}</time>
                </span>
            </CornerTag>
            <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                    <TrainingTypeIcon type={session.type} className="size-5" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">
                        <Link href={href} className="rounded-sm hover:underline">
                            {session.title}
                        </Link>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                        {TRAINING_TYPE_LABELS[session.type]} · {formatWeekdayDate(session.scheduledAt)}, {formatTime(session.scheduledAt)}
                        {end && `–${formatTime(end)}`}
                    </p>
                </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-[13px]">
                <Fact label="Where" value={session.location} />
                <Fact label="Coach" value={coachName ?? "To be confirmed"} />
                {intensity && <Fact label="Intensity" value={intensity} />}
            </dl>
            {note}
            <ButtonLink href={href} className="mt-auto w-fit">
                Open session plan
            </ButtonLink>
        </>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="font-display text-[12px] font-bold tracking-[0.08em] text-fg-subtle uppercase">{label}</dt>
            <dd className="mt-0.5 leading-snug font-medium break-words text-fg">{value}</dd>
        </div>
    );
}
