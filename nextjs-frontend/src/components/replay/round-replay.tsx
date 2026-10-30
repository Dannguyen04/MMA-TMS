"use client";

import { ArrowDownToLine, BatteryLow, Check, Droplet, Minus, Pause, Play, RotateCcw, ShieldAlert, X, Zap, type LucideIcon } from "lucide-react";
import { Fragment, useCallback, useRef, type CSSProperties } from "react";

import { useReducedMotion } from "@/components/fighter-3d/use-graphics";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { TONE_SOFT, TONE_TEXT, type Tone } from "@/components/ui/tone";
import type { RoundAdviceStanding, SelfScore, TacticOutcome } from "@/lib/domain/round-advice";
import type { Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import type { ReplayBreak, ReplayData, ReplayRound } from "./replay-data";
import styles from "./replay.module.css";
import { TypedLines } from "./typed-lines";
import { REST_WEIGHT, ROUND_WEIGHT, useReplay } from "./use-replay";

/** Seconds on screen: a round, then its corner break. */
const TIMING = { round: 3.2, rest: 3.6 };
const RING = 2 * Math.PI * 15;

const OUTCOME: Record<TacticOutcome, { tone: Tone; icon: LucideIcon }> = {
    EFFECTIVE: { tone: "success", icon: Check },
    INEFFECTIVE: { tone: "danger", icon: X },
    NOT_USED: { tone: "neutral", icon: Minus },
};

const SCORE_TONE: Record<SelfScore, Tone> = { WIN: "success", CLOSE: "warning", LOSS: "danger" };

interface RoundEvent {
    key: string;
    label: string;
    icon: LucideIcon;
    tone: Tone;
}

function roundEvents(round: ReplayRound, t: Translator): RoundEvent[] {
    const events: RoundEvent[] = [];
    if (round.knockdownsAgainst > 0) events.push({ key: "kd", label: t("figure3d.replay.knockdowns", { count: round.knockdownsAgainst }), icon: ArrowDownToLine, tone: "danger" });
    if (round.stunned) events.push({ key: "stun", label: t("boutAnalysis.rounds.stunned"), icon: Zap, tone: "danger" });
    if (round.bleeding) events.push({ key: "bleed", label: t("boutAnalysis.rounds.bleeding"), icon: Droplet, tone: "warning" });
    if (round.fatigued) events.push({ key: "tired", label: t("boutAnalysis.rounds.fatigued"), icon: BatteryLow, tone: "warning" });
    return events;
}

function standingLine(standing: RoundAdviceStanding, t: Translator): string {
    return standing.kind === "NEED_WINS"
        ? t("boutAnalysis.advice.standing.NEED_WINS", { needed: standing.needed, remaining: standing.remaining })
        : t(`boutAnalysis.advice.standing.${standing.kind}`);
}

function adviceLines(brk: ReplayBreak, t: Translator): string[] {
    return [
        standingLine(brk.standing, t),
        ...brk.keep.map((tactic) => t("figure3d.replay.keep", { tactic })),
        ...brk.dropped.map((tactic) => t("figure3d.replay.drop", { tactic })),
        ...brk.opponentChanged.map((tactic) => t("figure3d.replay.changed", { tactic })),
    ];
}

const initial = (name: string) => name.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "?";

export interface RoundReplayProps {
    data: ReplayData;
    fighter: string;
    opponent: string;
}

/**
 * The bout played back round by round from the coach's corner records: a playhead runs over each
 * round and break, the round's tactic marks turn over when its record "arrives", safety events and
 * the self score follow, and the break's advice is written out while the 60-second clock runs.
 * Nothing moves that was not recorded: no positions, no strikes.
 */
export function RoundReplay({ data, fighter, opponent }: RoundReplayProps) {
    const t = useT();
    const reduced = useReducedMotion();
    const playhead = useRef<HTMLDivElement>(null);
    const rings = useRef<(SVGCircleElement | null)[]>([]);
    const clocks = useRef<(HTMLSpanElement | null)[]>([]);
    const { rounds, tactics, breaks } = data;
    const count = rounds.length;

    const onFrame = useCallback((progress: number, breakLeft: number | null) => {
        if (playhead.current) playhead.current.style.left = `${(progress * 100).toFixed(3)}%`;
        if (breakLeft === null) return;
        for (let i = 0; i < rings.current.length; i++) {
            rings.current[i]?.setAttribute("stroke-dashoffset", String(RING * (1 - breakLeft)));
            const clock = clocks.current[i];
            if (clock) clock.textContent = `${Math.ceil(breakLeft * 60)} s`;
        }
    }, []);

    const { step, playing, play, pause, seek } = useReplay({ rounds: count, timing: TIMING, reduced, onFrame });
    const recorded = Math.floor(step / 2);
    const live = step % 2 === 1 ? (step + 1) / 2 : null;
    const resting = step > 0 && step % 2 === 0 && step < count * 2 ? step / 2 : null;
    const done = step >= count * 2;
    const wins = rounds.filter((r) => r.selfScore === "WIN").length;
    const columns = `minmax(160px, 220px) ${rounds.map((_, i) => (i === 0 ? `${ROUND_WEIGHT}fr` : `${REST_WEIGHT}fr ${ROUND_WEIGHT}fr`)).join(" ")}`;
    const roundColumn = (index: number) => 2 + index * 2;

    return (
        <section aria-labelledby="round-replay-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex shrink-0 -space-x-2" aria-hidden>
                        <span className="flex size-10 items-center justify-center rounded-full bg-corner-blue font-display text-lg font-extrabold text-white ring-2 ring-surface">{initial(fighter)}</span>
                        <span className="flex size-10 items-center justify-center rounded-full bg-corner-red font-display text-lg font-extrabold text-white ring-2 ring-surface">{initial(opponent)}</span>
                    </div>
                    <div className="min-w-0">
                        <h2 id="round-replay-title" className="font-display text-[22px] leading-6 font-extrabold text-fg italic">
                            {t("figure3d.replay.title")}
                        </h2>
                        <p className="text-sm text-pretty text-fg-muted">
                            {fighter} <span className="text-fg-subtle">vs</span> {opponent} · {t("figure3d.replay.source", { recorded: count, scheduled: data.scheduledRounds })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="icon" aria-label={t("figure3d.replay.restart")} title={t("figure3d.replay.restart")} onClick={() => seek(0)} disabled={step === 0 && !playing}>
                        <RotateCcw aria-hidden />
                    </Button>
                    <Button onClick={playing ? pause : play} className="min-w-28">
                        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                        {playing ? t("figure3d.replay.pause") : done ? t("figure3d.replay.again") : step === 0 ? t("figure3d.replay.play") : t("figure3d.replay.resume")}
                    </Button>
                </div>
            </header>
            <p className="border-b border-border px-5 py-2.5 text-[13px] text-fg-muted">{t("figure3d.replay.description")}</p>

            <div className="scrollbar-thin overflow-x-auto">
                <div className="relative grid gap-y-2 px-5 py-5" style={{ gridTemplateColumns: columns, gridTemplateRows: `repeat(${tactics.length + 3}, auto)`, minWidth: `${280 + count * 190}px` }}>
                    {/* Track */}
                    <div className="flex items-center text-xs font-semibold tracking-[0.06em] text-fg-subtle uppercase">{t("figure3d.replay.track")}</div>
                    {rounds.map((round, i) => (
                        <Fragment key={round.roundNo}>
                            {i > 0 && (
                                <div className={cn("flex h-12 items-center justify-center gap-2 rounded-lg text-xs transition-colors duration-200", resting === i ? "bg-primary-soft text-primary-soft-fg" : "text-fg-subtle")}>
                                    <svg viewBox="0 0 36 36" className={cn("size-7 -rotate-90", resting !== i && "hidden")} aria-hidden>
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
                                        <circle
                                            ref={(el) => {
                                                rings.current[i - 1] = el;
                                            }}
                                            cx="18"
                                            cy="18"
                                            r="15"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeDasharray={RING}
                                            strokeDashoffset={0}
                                        />
                                    </svg>
                                    <span
                                        ref={(el) => {
                                            clocks.current[i - 1] = el;
                                        }}
                                        className={cn("font-semibold tabular-nums", resting !== i && "hidden")}
                                    >
                                        60 s
                                    </span>
                                    {resting !== i && <span>{t("figure3d.replay.break")}</span>}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => seek((i + 1) * 2)}
                                aria-label={t("figure3d.replay.seekRound", { roundNo: round.roundNo })}
                                className={cn(
                                    "flex h-12 items-center justify-between rounded-lg px-3 text-left ring-1 ring-inset transition-[background-color,box-shadow,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]",
                                    live === i + 1 ? "bg-surface-muted ring-primary" : recorded > i ? "bg-surface-muted ring-border" : "ring-border hover:bg-surface-hover",
                                )}
                            >
                                <span className="font-display text-lg font-bold text-fg">{t("boutAnalysis.rounds.roundTitle", { roundNo: round.roundNo })}</span>
                                {live === i + 1 && <span className="text-xs text-fg-subtle">{t("figure3d.replay.fighting")}</span>}
                            </button>
                        </Fragment>
                    ))}

                    {/* Tactics */}
                    {tactics.length === 0 && <p className="col-span-full text-sm text-fg-subtle">{t("figure3d.replay.noTactics")}</p>}
                    {tactics.map((tactic, row) => {
                        const dropRound = data.droppedAfter[tactic.id];
                        const dropped = dropRound !== undefined && recorded >= dropRound;
                        return (
                            <Fragment key={tactic.id}>
                                <div className="flex min-h-14 flex-col justify-center pr-3">
                                    <span className={cn("text-sm leading-5 font-medium transition-colors duration-200", dropped ? "text-fg-subtle line-through" : "text-fg")}>{tactic.text}</span>
                                    {dropped && (
                                        <span className={cn("mt-1 w-fit rounded px-1.5 text-[11px] leading-5 font-semibold ring-1 ring-inset", TONE_SOFT.danger, styles.rise)}>
                                            {t("figure3d.replay.droppedAfter", { roundNo: dropRound })}
                                        </span>
                                    )}
                                </div>
                                {rounds.map((round, i) => {
                                    const outcome = round.marks[tactic.id];
                                    const meta = outcome ? OUTCOME[outcome] : null;
                                    const shown = recorded > i;
                                    const Icon = meta?.icon ?? Minus;
                                    return (
                                        <div key={round.roundNo} className="flex min-h-14 items-stretch" style={{ gridColumn: roundColumn(i) }}>
                                            <div
                                                className={cn(
                                                    "flex flex-1 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 ring-inset",
                                                    "transition-[transform,opacity,background-color] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity",
                                                    shown ? (meta ? TONE_SOFT[meta.tone] : "text-fg-subtle ring-border") : "bg-transparent text-transparent ring-border ring-dashed",
                                                    shown ? "[transform:rotateX(0deg)] opacity-100" : "[transform:rotateX(-80deg)] opacity-40 motion-reduce:[transform:none]",
                                                    live === i + 1 && "animate-pulse ring-primary/40",
                                                )}
                                                style={{ transitionDelay: shown ? `${row * 90}ms` : "0ms", transformOrigin: "50% 0%" } as CSSProperties}
                                                aria-hidden={!shown}
                                            >
                                                <Icon aria-hidden className="size-4 shrink-0" />
                                                {outcome ? t(`boutAnalysis.rounds.tacticMark.${outcome}`) : t("figure3d.replay.notRecorded")}
                                            </div>
                                        </div>
                                    );
                                })}
                            </Fragment>
                        );
                    })}

                    {/* Safety events */}
                    <div className="flex min-h-12 items-center text-sm font-medium text-fg-muted">{t("figure3d.replay.safety")}</div>
                    {rounds.map((round, i) => {
                        const events = roundEvents(round, t);
                        return (
                            <div key={round.roundNo} className="flex min-h-12 flex-wrap content-center items-center gap-1.5" style={{ gridColumn: roundColumn(i) }}>
                                {recorded > i &&
                                    (events.length === 0 ? (
                                        <span className={cn("text-sm text-fg-subtle", styles.rise)}>{t("figure3d.replay.noIncident")}</span>
                                    ) : (
                                        events.map((event, n) => {
                                            const Icon = event.icon;
                                            return (
                                                <span
                                                    key={event.key}
                                                    className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold ring-1 ring-inset", TONE_SOFT[event.tone], styles.rise)}
                                                    style={{ animationDelay: `${380 + n * 70}ms`, animationFillMode: "backwards" }}
                                                >
                                                    <Icon aria-hidden className="size-3.5" />
                                                    {event.label}
                                                </span>
                                            );
                                        })
                                    ))}
                            </div>
                        );
                    })}

                    {/* Self score */}
                    <div className="flex min-h-10 items-center text-sm font-medium text-fg-muted">{t("boutAnalysis.rounds.selfScoreLabel")}</div>
                    {rounds.map((round, i) => (
                        <div key={round.roundNo} className="flex min-h-10 items-center" style={{ gridColumn: roundColumn(i) }}>
                            {recorded > i && (
                                <span
                                    className={cn("font-display text-lg font-bold", round.selfScore ? TONE_TEXT[SCORE_TONE[round.selfScore]] : "text-fg-subtle", styles.rise)}
                                    style={{ animationDelay: "480ms", animationFillMode: "backwards" }}
                                >
                                    {t(`boutAnalysis.rounds.selfScore.${round.selfScore ?? "NONE"}`)}
                                </span>
                            )}
                        </div>
                    ))}

                    {/* Playhead over the round and break columns; absolute, so it takes no grid cells */}
                    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ gridColumn: "2 / -1", gridRow: "1 / -1" }}>
                        <div
                            ref={playhead}
                            className={cn("absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-corner-red transition-opacity duration-200", step === 0 ? "opacity-0" : "opacity-100")}
                            style={{ left: "0%" }}
                        >
                            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-corner-red" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Corner advice, one card per break */}
            {breaks.length > 0 && (
                <div className="grid gap-px border-t border-border bg-border md:grid-cols-2">
                    {breaks
                        .filter((brk) => brk.afterRound < count)
                        .map((brk) => {
                            const state = recorded < brk.afterRound ? "waiting" : resting === brk.afterRound ? "live" : "given";
                            return (
                                <section key={brk.afterRound} className={cn("bg-surface px-5 py-4 transition-colors duration-200", state === "live" && "bg-primary-soft/40")}>
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="font-display text-lg font-bold text-fg">{t("figure3d.replay.adviceAfter", { roundNo: brk.afterRound })}</h3>
                                        <span className="text-xs text-fg-subtle">
                                            {state === "waiting" ? t("figure3d.replay.adviceWaiting") : state === "live" ? t("figure3d.replay.adviceLive") : t("figure3d.replay.adviceGiven")}
                                        </span>
                                    </div>
                                    {state !== "waiting" && brk.safety && (
                                        <div className={cn("mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset", TONE_SOFT.danger, styles.rise)}>
                                            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                                            <div>
                                                <p className="font-semibold">{t("boutAnalysis.advice.safetyRedTitle")}</p>
                                                <p>{brk.safety.reasons.map((reason) => t(`boutAnalysis.advice.safetyReason.${reason}`)).join(" · ")}</p>
                                            </div>
                                        </div>
                                    )}
                                    {state === "waiting" ? (
                                        <p className="mt-2 text-sm text-fg-subtle">{t("figure3d.replay.adviceHint", { roundNo: brk.afterRound })}</p>
                                    ) : (
                                        <TypedLines key={`${brk.afterRound}-${state === "live"}`} lines={adviceLines(brk, t)} typing={state === "live" && !reduced} />
                                    )}
                                </section>
                            );
                        })}
                </div>
            )}

            {done && (
                <footer className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-surface-muted px-5 py-4 text-sm", styles.rise)}>
                    <span className="font-display text-xl font-extrabold text-fg italic">{t("figure3d.replay.summary", { wins, rounds: count })}</span>
                    <span className="text-fg-muted">{t("boutAnalysis.advice.coachDecisionNote")}</span>
                </footer>
            )}
        </section>
    );
}
