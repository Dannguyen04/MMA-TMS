import { ArrowRight, Camera, ClipboardList, Clock, HeartPulse, PenLine, ShieldQuestion, ShieldX, Sparkles, TriangleAlert, Upload, UserCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FighterJourney } from "@/components/domain/fighter-journey";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { plannedEndMs, rpeText } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { CornerTag } from "@/components/ui/corner-tag";
import { AI_REVIEW_TERMS, formatReviewCounts } from "@/lib/domain/ai-review";
import type { FighterJourney as Journey } from "@/lib/domain/journey";
import { TRAINING_PHASE_LABELS, TRAINING_TYPE_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { isLowConfidence } from "@/lib/domain/rules";
import type { AIFeedback, TrainingPhase, TrainingSession, UpcomingBout } from "@/lib/domain/types";
import { formatConfidence, formatDateTime, formatPercent, formatRelative, formatShortDate, formatTime, formatWeekdayDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { relativeDay } from "./dashboard-utils";
import { campDayLabel, campTimeline } from "./fight-camp";

/** What the right half of the hero shows: the one thing to do next, or what training waits for. */
export type NextUp =
    | { kind: "session"; session: TrainingSession; coachName?: string; href: string; note?: ReactNode }
    | { kind: "paused"; reason: "not_cleared" | "expired"; doctorName?: string; followUpDate: string | null; healthHref: string }
    /** Training can't start yet: the journey step in the way, in plain words, and who's on it. */
    | { kind: "blocked"; title: string; body: string; owner: string; attention: boolean; healthHref: string }
    /** Cleared and nothing blocks: get the AI on the fighter's technique. */
    | { kind: "analyse"; reason: "first" | "again" | "retry"; uploadHref: string; liveCheckHref: string }
    | { kind: "processing"; videoTitle: string; uploadedAt: string; href: string };

/** The active training plan, shown as one line under the camp. */
export interface HeroPlan {
    title: string;
    href: string;
    phase: TrainingPhase;
    adherencePct: number | null;
}

/** The latest AI analysis, led by one finding. */
export interface HeroAnalysis {
    href: string;
    videoTitle: string;
    processedAt: string;
    /** The finding to lead with, already phrased as an observation; null when there's none to show. */
    headline: { title: string; confidence: number; review: AIFeedback | null } | null;
    /** Who signed off the whole analysis, if a coach has. */
    coachReviewer: string | null;
    /** Unreviewed detections below the low-confidence threshold. */
    lowConfidenceDetections: number;
}

export interface FightHeroProps {
    bout: UpcomingBout | null;
    /** Start of the fight-camp plan preparing this bout, if there is one. */
    campStart: string | null;
    plan: HeroPlan | null;
    /** Shown in place of the camp while the fighter's journey to training isn't complete. */
    journey: Journey | null;
    analysis: HeroAnalysis | null;
    next: NextUp;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/**
 * The fighter's Today hero on the blue-corner ground: their journey to training while it's incomplete, otherwise the
 * fight-camp countdown or the latest AI analysis; and the one thing to do next beside it. Server Component.
 */
export function FightHero({ bout, campStart, plan, journey, analysis, next, now, className }: FightHeroProps) {
    return (
        <section aria-label="Your next step" className={cn("grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]", className)}>
            <div className="relative isolate flex min-w-0 flex-col gap-4 px-6 py-6 text-white sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-tl cage-hatch bg-hero-bg" />
                {journey ? (
                    <FighterJourney journey={journey} variant="full" ground="hero" hideNextAction />
                ) : bout ? (
                    <>
                        <Camp bout={bout} campStart={campStart} now={now} />
                        {analysis && <AnalysisLine analysis={analysis} />}
                    </>
                ) : analysis ? (
                    <AnalysisLead analysis={analysis} now={now} />
                ) : (
                    <OffCamp plan={plan} />
                )}
                {plan && <PlanLine plan={plan} />}
            </div>
            <div className="relative isolate flex min-w-0 flex-col gap-3.5 px-6 py-6 sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-br bg-surface" />
                <NextUpPanel next={next} now={now} />
            </div>
        </section>
    );
}

/** Whether a session is under way at `now`. */
export function isSessionLive(session: Pick<TrainingSession, "status" | "scheduledAt" | "durationMin">, now: string): boolean {
    return session.status === "in_progress" || (Date.parse(session.scheduledAt) <= Date.parse(now) && plannedEndMs(session) > Date.parse(now));
}

function Camp({ bout, campStart, now }: { bout: UpcomingBout; campStart: string | null; now: string }) {
    const timeline = campTimeline(bout, campStart, now);
    const label = campDayLabel(timeline);

    return (
        <>
            <CornerTag tone="stage">{label}</CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]">{bout.event}</h2>
                <p className="mt-1 text-[15px] text-white/85">
                    vs {bout.opponent} · <time dateTime={bout.date}>{formatWeekdayDate(bout.date)}</time> · {WEIGHT_CLASS_LABELS[bout.weightClass]}
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

/* ─── AI analysis ─────────────────────────────────────────────────────────── */

/** How far a human has checked the analysis, in the review badges' words, as an icon and a label (the hero ground takes no tone badges). */
function reviewState(analysis: HeroAnalysis): { icon: LucideIcon; label: string } {
    const review = analysis.headline?.review;
    if (review?.decision === "confirmed") return { icon: UserCheck, label: `Confirmed by ${review.reviewerName}` };
    if (review?.decision === "corrected") return { icon: PenLine, label: `Corrected by ${review.reviewerName}` };
    if (analysis.coachReviewer) return { icon: UserCheck, label: `Coach reviewed · ${analysis.coachReviewer}` };
    const [lowConfidence] = formatReviewCounts({ lowConfidenceDetections: analysis.lowConfidenceDetections });
    if (lowConfidence) return { icon: TriangleAlert, label: `${AI_REVIEW_TERMS.needsReview} · ${lowConfidence}` };
    return { icon: Clock, label: "Awaiting coach review" };
}

function confidenceText(headline: NonNullable<HeroAnalysis["headline"]>): string {
    const text = `${formatConfidence(headline.confidence)} confidence`;
    return headline.review === null && isLowConfidence(headline.confidence) ? `${text} · ${AI_REVIEW_TERMS.needsReview.toLowerCase()}` : text;
}

/** The latest analysis as the hero's lead: one finding, how sure the AI is, and whether a coach has checked it. */
function AnalysisLead({ analysis, now }: { analysis: HeroAnalysis; now: string }) {
    const { headline } = analysis;
    const state = reviewState(analysis);
    return (
        <>
            <CornerTag tone="stage">
                <Sparkles aria-hidden />
                Latest AI analysis
            </CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]">
                    {headline ? (
                        <>
                            <span className="sr-only">AI finding: </span>
                            {headline.title}
                        </>
                    ) : (
                        "Your analysis is ready"
                    )}
                </h2>
                <p className="mt-1 text-[15px] text-pretty text-white/85">
                    {analysis.videoTitle} · analysed{" "}
                    <time dateTime={analysis.processedAt} title={formatDateTime(analysis.processedAt)}>
                        {formatRelative(analysis.processedAt, now)}
                    </time>
                </p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-white">
                <li className="inline-flex items-center gap-1.5">
                    <Sparkles aria-hidden className="size-3.5 shrink-0" />
                    {headline ? `AI-generated · ${confidenceText(headline)}` : "AI-generated"}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <state.icon aria-hidden className="size-3.5 shrink-0" />
                    {state.label}
                </li>
            </ul>
            <p className="text-[13px] text-pretty text-white/85">AI results are estimates. Your coach reviews them; treat unreviewed items as a guide.</p>
            <Link href={analysis.href} className="inline-flex w-fit items-center gap-1 rounded-sm text-[14px] font-semibold text-white underline-offset-2 hover:underline">
                Open the analysis
                <ArrowRight aria-hidden className="size-4" />
            </Link>
        </>
    );
}

/** One line under the fight camp for the latest analysis. */
function AnalysisLine({ analysis }: { analysis: HeroAnalysis }) {
    const state = reviewState(analysis);
    return (
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/20 pt-3 text-[13px] text-white/85">
            <Sparkles aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">Latest AI analysis: </span>
            <Link href={analysis.href} className="min-w-0 rounded-sm font-medium text-white underline-offset-2 hover:underline">
                {analysis.headline?.title ?? analysis.videoTitle}
            </Link>
            <span>· {state.label}</span>
        </p>
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

/* ─── Next up ─────────────────────────────────────────────────────────────── */

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

const ANALYSE_COPY: Record<"first" | "again" | "retry", { title: string; body: string }> = {
    first: {
        title: "Get your first AI analysis",
        body: "Film a round of shadow boxing, pads or bag work. The AI maps your strikes, guard and footwork, and your coach reviews what it finds.",
    },
    again: {
        title: "Put your next round under the AI",
        body: "Upload a new round to track your technique over time. Your coach reviews what the AI finds.",
    },
    retry: {
        title: "Your last upload didn't process",
        body: "Try another clip with your whole body in frame, in steady light, with only you in the shot.",
    },
};

function NextUpPanel({ next, now }: { next: NextUp; now: string }) {
    switch (next.kind) {
        case "paused":
            return <PausedPanel next={next} />;
        case "blocked":
            return (
                <>
                    <CornerTag tone={next.attention ? "red" : "neutral"}>
                        {next.attention ? <ShieldX aria-hidden /> : <ShieldQuestion aria-hidden />}
                        {next.attention ? "Training paused" : "Before you train"}
                    </CornerTag>
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">{next.title}</h2>
                    <p className="text-sm text-pretty text-fg-muted">{next.body}</p>
                    <p className="text-[13px] text-fg-muted">
                        With: <span className="font-medium text-fg">{next.owner}</span>
                    </p>
                    <ButtonLink href={next.healthHref} variant="secondary" className="mt-auto w-fit">
                        <HeartPulse aria-hidden />
                        View health &amp; care team
                    </ButtonLink>
                </>
            );
        case "analyse": {
            const copy = ANALYSE_COPY[next.reason];
            return (
                <>
                    <CornerTag tone="blue">
                        <Sparkles aria-hidden />
                        AI analysis
                    </CornerTag>
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">{copy.title}</h2>
                    <p className="text-sm text-pretty text-fg-muted">{copy.body}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                        {/* The label wraps in the narrow half of the hero rather than overflowing it. */}
                        <ButtonLink href={next.uploadHref} className="h-auto! min-h-9 py-2 text-left whitespace-normal!">
                            <Upload aria-hidden />
                            Upload a video for AI analysis
                        </ButtonLink>
                        <ButtonLink href={next.liveCheckHref} variant="ghost">
                            <Camera aria-hidden />
                            Live form check
                        </ButtonLink>
                    </div>
                </>
            );
        }
        case "processing":
            return (
                <>
                    <CornerTag tone="blue">
                        <Sparkles aria-hidden />
                        AI analysis
                    </CornerTag>
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">The AI is analysing your video</h2>
                    <p className="text-sm text-pretty text-fg-muted">
                        {next.videoTitle} · uploaded{" "}
                        <time dateTime={next.uploadedAt} title={formatDateTime(next.uploadedAt)}>
                            {formatRelative(next.uploadedAt, now)}
                        </time>
                        . The results land here, and your coach reviews them.
                    </p>
                    <ButtonLink href={next.href} variant="secondary" className="mt-auto w-fit">
                        View progress
                    </ButtonLink>
                </>
            );
        case "session":
            return <SessionPanel next={next} now={now} />;
    }
}

function PausedPanel({ next }: { next: Extract<NextUp, { kind: "paused" }> }) {
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

function SessionPanel({ next, now }: { next: Extract<NextUp, { kind: "session" }>; now: string }) {
    const { session, coachName, href, note } = next;
    const end = session.durationMin === null ? null : new Date(plannedEndMs(session)).toISOString();
    const intensity = rpeText(session.targetRpe);
    const inProgress = isSessionLive(session, now);

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
