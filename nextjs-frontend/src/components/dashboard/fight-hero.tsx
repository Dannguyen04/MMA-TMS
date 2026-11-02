import { ArrowRight, Camera, ClipboardList, Clock, HeartPulse, PenLine, ShieldQuestion, ShieldX, Sparkles, TriangleAlert, Upload, UserCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FighterJourney } from "@/components/domain/fighter-journey";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { plannedEndMs, rpeTextFor } from "@/components/training/training-utils";
import { ButtonLink } from "@/components/ui/button";
import { CornerTag } from "@/components/ui/corner-tag";
import type { FighterJourney as Journey } from "@/lib/domain/journey";
import { weightClassLabel } from "@/lib/domain/labels";
import { isLowConfidence } from "@/lib/domain/rules";
import type { AIFeedback, TrainingPhase, TrainingSession, UpcomingBout } from "@/lib/domain/types";
import { formatConfidence, formatDateTime, formatPercent, formatRelative, formatShortDate, formatTime, formatWeekdayDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { plural, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { relativeDayText } from "./dashboard-utils";
import { campDayText, campTimeline } from "./fight-camp";

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
    t: Translator;
    locale: Locale;
    className?: string;
}

interface Lang {
    t: Translator;
    locale: Locale;
}

/**
 * The fighter's Today hero on the blue-corner ground: their journey to training while it's incomplete, otherwise the
 * fight-camp countdown or the latest AI analysis; and the one thing to do next beside it. Server Component.
 */
export function FightHero({ bout, campStart, plan, journey, analysis, next, now, t, locale, className }: FightHeroProps) {
    return (
        <section aria-label={t("hero.section")} className={cn("grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]", className)}>
            <div className="relative isolate flex min-w-0 flex-col gap-4 px-6 py-6 text-white sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-tl cage-hatch bg-hero-bg" />
                {journey ? (
                    <FighterJourney journey={journey} variant="full" ground="hero" hideNextAction locale={locale} />
                ) : bout ? (
                    <>
                        <Camp bout={bout} campStart={campStart} now={now} t={t} locale={locale} />
                        {analysis && <AnalysisLine analysis={analysis} t={t} />}
                    </>
                ) : analysis ? (
                    <AnalysisLead analysis={analysis} now={now} t={t} locale={locale} />
                ) : (
                    <OffCamp plan={plan} t={t} />
                )}
                {plan && <PlanLine plan={plan} t={t} />}
            </div>
            <div className="relative isolate flex min-w-0 flex-col gap-3.5 px-6 py-6 sm:px-7">
                <div aria-hidden className="absolute inset-0 -z-10 chamfer-br bg-surface" />
                <NextUpPanel next={next} now={now} t={t} locale={locale} />
            </div>
        </section>
    );
}

/** Whether a session is under way at `now`. */
export function isSessionLive(session: Pick<TrainingSession, "status" | "scheduledAt" | "durationMin">, now: string): boolean {
    return session.status === "in_progress" || (Date.parse(session.scheduledAt) <= Date.parse(now) && plannedEndMs(session) > Date.parse(now));
}

function Camp({ bout, campStart, now, t, locale }: { bout: UpcomingBout; campStart: string | null; now: string } & Lang) {
    const timeline = campTimeline(bout, campStart, now);
    const label = campDayText(t, timeline);

    return (
        <>
            <CornerTag tone="stage">{label}</CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]">{bout.event}</h2>
                <p className="mt-1 text-[15px] text-white/85">
                    {t("bout.versus", { opponent: bout.opponent })} · <time dateTime={bout.date}>{formatWeekdayDate(bout.date, locale)}</time> ·{" "}
                    {weightClassLabel(bout.weightClass, locale)}
                </p>
            </div>
            <p className="flex items-end gap-3">
                <span className="font-display text-[76px] leading-[0.8] font-extrabold tracking-tight tabular-nums italic sm:text-[88px]">{timeline.daysToGo}</span>
                <span className="pb-1 font-display text-[15px] leading-tight font-bold tracking-[0.1em] uppercase">
                    {plural(t, "hero.daysTo", timeline.daysToGo)}
                    <br />
                    {t("hero.fightNightLine")}
                </span>
            </p>
            <div>
                <div
                    role="progressbar"
                    aria-label={t("hero.campProgress")}
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
                    <Milestone label={t(timeline.estimatedStart ? "hero.campStartEstimated" : "hero.campStart")} date={timeline.start} locale={locale} />
                    <Milestone label={t("hero.fightWeek")} date={timeline.fightWeek} locale={locale} className="text-center" />
                    <Milestone label={t("hero.fightNight")} date={bout.date} locale={locale} className="text-right" />
                </ol>
            </div>
        </>
    );
}

function Milestone({ label, date, locale, className }: { label: string; date: string; locale: Locale; className?: string }) {
    return (
        <li className={cn("min-w-0", className)}>
            {label}
            <time dateTime={date} className="mt-0.5 block font-display text-[15px] font-bold text-white">
                {formatShortDate(date, locale)}
            </time>
        </li>
    );
}

function OffCamp({ plan, t }: { plan: HeroPlan | null; t: Translator }) {
    return (
        <>
            <CornerTag tone="stage">{plan ? t("hero.phase", { phase: t(`phase.${plan.phase}`) }) : t("hero.offCamp")}</CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold italic sm:text-[34px]">{t("hero.noBout")}</h2>
                <p className="mt-1 max-w-md text-[15px] text-pretty text-white/85">{t("hero.noBoutText")}</p>
            </div>
        </>
    );
}

/* ─── AI analysis ─────────────────────────────────────────────────────────── */

/** How far a human has checked the analysis, in the review badges' words, as an icon and a label (the hero ground takes no tone badges). */
function reviewState(analysis: HeroAnalysis, t: Translator): { icon: LucideIcon; label: string } {
    const review = analysis.headline?.review;
    if (review?.decision === "confirmed") return { icon: UserCheck, label: t("hero.analysis.confirmedBy", { name: review.reviewerName }) };
    if (review?.decision === "corrected") return { icon: PenLine, label: t("hero.analysis.correctedBy", { name: review.reviewerName }) };
    if (analysis.coachReviewer) return { icon: UserCheck, label: t("hero.analysis.coachReviewed", { name: analysis.coachReviewer }) };
    if (analysis.lowConfidenceDetections > 0) return { icon: TriangleAlert, label: plural(t, "hero.analysis.needsReview", analysis.lowConfidenceDetections) };
    return { icon: Clock, label: t("hero.analysis.awaiting") };
}

function confidenceText(headline: NonNullable<HeroAnalysis["headline"]>, t: Translator): string {
    const pct = formatConfidence(headline.confidence);
    return t(headline.review === null && isLowConfidence(headline.confidence) ? "hero.analysis.confidenceNeedsReview" : "hero.analysis.confidence", { pct });
}

/** The latest analysis as the hero's lead: one finding, how sure the AI is, and whether a coach has checked it. */
function AnalysisLead({ analysis, now, t, locale }: { analysis: HeroAnalysis; now: string } & Lang) {
    const { headline } = analysis;
    const state = reviewState(analysis, t);
    return (
        <>
            <CornerTag tone="stage">
                <Sparkles aria-hidden />
                {t("hero.analysis.tag")}
            </CornerTag>
            <div>
                <h2 className="font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]">
                    {headline ? (
                        <>
                            <span className="sr-only">{t("hero.analysis.findingSr")}</span>
                            {headline.title}
                        </>
                    ) : (
                        t("hero.analysis.ready")
                    )}
                </h2>
                <p className="mt-1 text-[15px] text-pretty text-white/85">
                    {t("hero.analysis.analysed", { video: analysis.videoTitle })}{" "}
                    <time dateTime={analysis.processedAt} title={formatDateTime(analysis.processedAt, locale)}>
                        {formatRelative(analysis.processedAt, now, locale)}
                    </time>
                </p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-white">
                <li className="inline-flex items-center gap-1.5">
                    <Sparkles aria-hidden className="size-3.5 shrink-0" />
                    {headline ? t("hero.analysis.aiGeneratedWith", { confidence: confidenceText(headline, t) }) : t("hero.analysis.aiGenerated")}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <state.icon aria-hidden className="size-3.5 shrink-0" />
                    {state.label}
                </li>
            </ul>
            <p className="text-[13px] text-pretty text-white/85">{t("hero.analysis.estimates")}</p>
            <Link href={analysis.href} className="inline-flex w-fit items-center gap-1 rounded-sm text-[14px] font-semibold text-white underline-offset-2 hover:underline">
                {t("hero.analysis.open")}
                <ArrowRight aria-hidden className="size-4" />
            </Link>
        </>
    );
}

/** One line under the fight camp for the latest analysis. */
function AnalysisLine({ analysis, t }: { analysis: HeroAnalysis; t: Translator }) {
    const state = reviewState(analysis, t);
    return (
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/20 pt-3 text-[13px] text-white/85">
            <Sparkles aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">{t("hero.analysis.lineSr")}</span>
            <Link href={analysis.href} className="min-w-0 rounded-sm font-medium text-white underline-offset-2 hover:underline">
                {analysis.headline?.title ?? analysis.videoTitle}
            </Link>
            <span>· {state.label}</span>
        </p>
    );
}

function PlanLine({ plan, t }: { plan: HeroPlan; t: Translator }) {
    return (
        <p className="mt-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/20 pt-3 text-[13px] text-white/85">
            <ClipboardList aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">{t("hero.planLabel")}</span>
            <Link href={plan.href} className="min-w-0 rounded-sm font-medium text-white underline-offset-2 hover:underline">
                {plan.title}
            </Link>
            {plan.adherencePct !== null && <span>{t("hero.adherence", { pct: formatPercent(plan.adherencePct) })}</span>}
        </p>
    );
}

/* ─── Next up ─────────────────────────────────────────────────────────────── */

function NextUpPanel({ next, now, t, locale }: { next: NextUp; now: string } & Lang) {
    switch (next.kind) {
        case "paused":
            return <PausedPanel next={next} t={t} locale={locale} />;
        case "blocked":
            return (
                <>
                    <CornerTag tone={next.attention ? "red" : "neutral"}>
                        {next.attention ? <ShieldX aria-hidden /> : <ShieldQuestion aria-hidden />}
                        {t(next.attention ? "hero.pausedTag" : "hero.beforeYouTrain")}
                    </CornerTag>
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">{next.title}</h2>
                    <p className="text-sm text-pretty text-fg-muted">{next.body}</p>
                    <p className="text-[13px] text-fg-muted">
                        {t("hero.with")} <span className="font-medium text-fg">{next.owner}</span>
                    </p>
                    <ButtonLink href={next.healthHref} variant="secondary" className="mt-auto w-fit">
                        <HeartPulse aria-hidden />
                        {t("hero.viewCareTeam")}
                    </ButtonLink>
                </>
            );
        case "analyse":
            return (
                <>
                    <CornerTag tone="blue">
                        <Sparkles aria-hidden />
                        {t("hero.analyse.tag")}
                    </CornerTag>
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">{t(`hero.analyse.${next.reason}.title`)}</h2>
                    <p className="text-sm text-pretty text-fg-muted">{t(`hero.analyse.${next.reason}.body`)}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                        {/* The label wraps in the narrow half of the hero rather than overflowing it. */}
                        <ButtonLink href={next.uploadHref} className="h-auto! min-h-9 py-2 text-left whitespace-normal!">
                            <Upload aria-hidden />
                            {t("hero.analyse.upload")}
                        </ButtonLink>
                        <ButtonLink href={next.liveCheckHref} variant="ghost">
                            <Camera aria-hidden />
                            {t("hero.analyse.liveCheck")}
                        </ButtonLink>
                    </div>
                </>
            );
        case "processing":
            return (
                <>
                    <CornerTag tone="blue">
                        <Sparkles aria-hidden />
                        {t("hero.analyse.tag")}
                    </CornerTag>
                    <h2 className="text-[17px] leading-snug font-semibold text-pretty text-fg">{t("hero.processing.title")}</h2>
                    <p className="text-sm text-pretty text-fg-muted">
                        {t("hero.processing.uploaded", { video: next.videoTitle })}{" "}
                        <time dateTime={next.uploadedAt} title={formatDateTime(next.uploadedAt, locale)}>
                            {formatRelative(next.uploadedAt, now, locale)}
                        </time>
                        {t("hero.processing.after")}
                    </p>
                    <ButtonLink href={next.href} variant="secondary" className="mt-auto w-fit">
                        {t("hero.processing.viewProgress")}
                    </ButtonLink>
                </>
            );
        case "session":
            return <SessionPanel next={next} now={now} t={t} locale={locale} />;
    }
}

function PausedPanel({ next, t, locale }: { next: Extract<NextUp, { kind: "paused" }> } & Lang) {
    return (
        <>
            <CornerTag tone="red">
                <ShieldX aria-hidden />
                {t("hero.pausedTag")}
            </CornerTag>
            <h2 className="text-[17px] leading-snug font-semibold text-fg">{t(`hero.paused.${next.reason}.title`)}</h2>
            <p className="text-sm text-pretty text-fg-muted">{t(`hero.paused.${next.reason}.body`)}</p>
            <p className="text-[13px] text-fg-muted">
                {t("hero.nextCheck")}{" "}
                {next.followUpDate ? (
                    <span className="font-medium text-fg">
                        <time dateTime={next.followUpDate}>{formatWeekdayDate(next.followUpDate, locale)}</time>
                        {next.doctorName ? t("hero.withDoctor", { name: next.doctorName }) : ""}
                    </span>
                ) : (
                    t("hero.doctorWillArrange")
                )}
            </p>
            <ButtonLink href={next.healthHref} className="mt-auto w-fit">
                <HeartPulse aria-hidden />
                {t("hero.viewHealth")}
            </ButtonLink>
        </>
    );
}

function SessionPanel({ next, now, t, locale }: { next: Extract<NextUp, { kind: "session" }>; now: string } & Lang) {
    const { session, coachName, href, note } = next;
    const end = session.durationMin === null ? null : new Date(plannedEndMs(session)).toISOString();
    const intensity = rpeTextFor(t, session.targetRpe);
    const inProgress = isSessionLive(session, now);

    return (
        <>
            <CornerTag tone="blue">
                <span>
                    {inProgress ? t("hero.happeningNow") : t("hero.nextUp", { when: relativeDayText(t, session.scheduledAt, now) })} ·{" "}
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
                        {t(`trainingType.${session.type}`)} · {formatWeekdayDate(session.scheduledAt, locale)}, {formatTime(session.scheduledAt)}
                        {end && `–${formatTime(end)}`}
                    </p>
                </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-[13px]">
                <Fact label={t("hero.where")} value={session.location} />
                <Fact label={t("hero.coach")} value={coachName ?? t("hero.toBeConfirmed")} />
                {intensity && <Fact label={t("hero.intensity")} value={intensity} />}
            </dl>
            {note}
            <ButtonLink href={href} className="mt-auto w-fit">
                {t("hero.openPlan")}
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
