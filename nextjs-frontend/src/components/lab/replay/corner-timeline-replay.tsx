"use client";

import { Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { Fragment, useCallback, useRef, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { TONE_SOFT, TONE_TEXT } from "@/components/ui/tone";
import { cn } from "@/lib/utils";
import { LAB_FIGHTER } from "../lab-data";
import styles from "../lab.module.css";
import { useReducedMotion } from "@/components/fighter-3d/use-graphics";
import { LAST_STEP, OUTCOME_META, ROUNDS, SCORE_META, TACTICS, breakAfter, droppedAfter, roundEvents, roundInProgress, roundsRecorded } from "./replay-model";
import { TypedLines } from "@/components/replay/typed-lines";
import { REST_WEIGHT, ROUND_WEIGHT, useReplay } from "@/components/replay/use-replay";

const TIMING = { round: 3.2, rest: 3.6 };
const RING = 2 * Math.PI * 15;

/** Track columns: the label column, then round / break / round / break / round. */
const COLUMNS = `minmax(180px, 220px) ${ROUNDS.map((_, i) => (i === 0 ? `${ROUND_WEIGHT}fr` : `${REST_WEIGHT}fr ${ROUND_WEIGHT}fr`)).join(" ")}`;

/** Grid column (1-based) of round n. */
const roundColumn = (n: number) => 2 + (n - 1) * 2;

export function CornerTimelineReplay() {
    const reduced = useReducedMotion();
    const playhead = useRef<HTMLDivElement>(null);
    const rings = useRef<(SVGCircleElement | null)[]>([]);
    const clocks = useRef<(HTMLSpanElement | null)[]>([]);

    const onFrame = useCallback((progress: number, breakLeft: number | null) => {
        if (playhead.current) playhead.current.style.left = `${(progress * 100).toFixed(3)}%`;
        if (breakLeft === null) return;
        for (let i = 0; i < rings.current.length; i++) {
            rings.current[i]?.setAttribute("stroke-dashoffset", String(RING * (1 - breakLeft)));
            const clock = clocks.current[i];
            if (clock) clock.textContent = `${Math.ceil(breakLeft * 60)} s`;
        }
    }, []);

    const { step, playing, play, pause, seek } = useReplay({ rounds: ROUNDS.length, timing: TIMING, reduced, onFrame });
    const recorded = roundsRecorded(step);
    const live = roundInProgress(step);
    const resting = breakAfter(step);
    const done = step >= LAST_STEP;
    const wins = ROUNDS.filter((r) => r.selfScore === "WIN").length;

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-2" aria-hidden>
                        <span className="flex size-10 items-center justify-center rounded-full bg-corner-blue font-display text-lg font-extrabold text-white ring-2 ring-surface">K</span>
                        <span className="flex size-10 items-center justify-center rounded-full bg-corner-red font-display text-lg font-extrabold text-white ring-2 ring-surface">B</span>
                    </div>
                    <div>
                        <p className="font-display text-[22px] leading-6 font-extrabold text-fg italic">
                            {LAB_FIGHTER.name} <span className="font-semibold text-fg-subtle not-italic">vs</span> {LAB_FIGHTER.opponent}
                        </p>
                        <p className="text-sm text-fg-muted">Hạng nhẹ · 3 hiệp × 5 phút · dữ liệu HLV ghi tại góc đài</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="icon" aria-label="Phát lại từ đầu" onClick={() => seek(0)} disabled={step === 0 && !playing}>
                        <RotateCcw aria-hidden />
                    </Button>
                    <Button onClick={playing ? pause : play} className="min-w-28">
                        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                        {playing ? "Tạm dừng" : done ? "Phát lại" : step === 0 ? "Phát" : "Tiếp tục"}
                    </Button>
                </div>
            </header>

            <div className="scrollbar-thin overflow-x-auto">
                <div className="relative grid min-w-[820px] gap-y-2 px-5 py-5" style={{ gridTemplateColumns: COLUMNS, gridTemplateRows: `repeat(${TACTICS.length + 3}, auto)` }}>
                    {/* Track */}
                    <div className="flex items-center text-xs font-semibold tracking-[0.06em] text-fg-subtle uppercase">Diễn biến</div>
                    {ROUNDS.map((round, i) => (
                        <Fragment key={round.roundNo}>
                            {i > 0 && (
                                <div
                                    className={cn(
                                        "flex h-12 items-center justify-center gap-2 rounded-lg text-xs transition-colors",
                                        resting === i ? "bg-primary-soft text-primary-soft-fg" : "text-fg-subtle",
                                    )}
                                >
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
                                    {resting !== i && <span>Nghỉ</span>}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => seek(round.roundNo * 2)}
                                aria-label={`Xem hết hiệp ${round.roundNo}`}
                                className={cn(
                                    "flex h-12 items-center justify-between rounded-lg px-3 text-left ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                    live === round.roundNo
                                        ? "bg-surface-muted ring-primary"
                                        : recorded >= round.roundNo
                                          ? "bg-surface-muted ring-border"
                                          : "ring-border hover:bg-surface-hover",
                                )}
                            >
                                <span className="font-display text-lg font-bold text-fg">Hiệp {round.roundNo}</span>
                                <span className="text-xs text-fg-subtle tabular-nums">{live === round.roundNo ? "đang đấu" : "5:00"}</span>
                            </button>
                        </Fragment>
                    ))}

                    {/* Tactics */}
                    {TACTICS.map((tactic, row) => {
                        const dropRound = droppedAfter(tactic.id);
                        const dropped = dropRound !== null && recorded >= dropRound;
                        return (
                            <Fragment key={tactic.id}>
                                <div className="flex min-h-14 flex-col justify-center pr-3">
                                    <span className={cn("text-sm leading-5 font-medium transition-colors", dropped ? "text-fg-subtle line-through" : "text-fg")}>{tactic.text}</span>
                                    {dropped && (
                                        <span className={cn("mt-1 w-fit rounded px-1.5 text-[11px] leading-5 font-semibold ring-1 ring-inset", TONE_SOFT.danger, styles.rise)}>
                                            Bỏ sau hiệp {dropRound}: hai hiệp không hiệu quả
                                        </span>
                                    )}
                                </div>
                                {ROUNDS.map((round) => {
                                    const outcome = round.tacticMarks[tactic.id];
                                    const meta = OUTCOME_META[outcome];
                                    const shown = recorded >= round.roundNo;
                                    const Icon = meta.icon;
                                    return (
                                        <div key={round.roundNo} className="flex min-h-14 items-stretch" style={{ gridColumn: roundColumn(round.roundNo) }}>
                                            <div
                                                className={cn(
                                                    "flex flex-1 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 ring-inset",
                                                    "transition-[transform,opacity,background-color] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity",
                                                    shown ? TONE_SOFT[meta.tone] : "bg-transparent text-transparent ring-border ring-dashed",
                                                    shown ? "[transform:rotateX(0deg)] opacity-100" : "[transform:rotateX(-80deg)] opacity-40 motion-reduce:[transform:none]",
                                                    live === round.roundNo && "animate-pulse ring-primary/40",
                                                )}
                                                style={{ transitionDelay: shown ? `${row * 110}ms` : "0ms", transformOrigin: "50% 0%" } as CSSProperties}
                                                aria-hidden={!shown}
                                            >
                                                <Icon aria-hidden className="size-4 shrink-0" />
                                                {meta.label}
                                            </div>
                                        </div>
                                    );
                                })}
                            </Fragment>
                        );
                    })}

                    {/* Events */}
                    <div className="flex min-h-12 items-center text-sm font-medium text-fg-muted">An toàn</div>
                    {ROUNDS.map((round) => {
                        const shown = recorded >= round.roundNo;
                        const events = roundEvents(round);
                        return (
                            <div key={round.roundNo} className="flex min-h-12 flex-wrap content-center items-center gap-1.5" style={{ gridColumn: roundColumn(round.roundNo) }}>
                                {shown &&
                                    (events.length === 0 ? (
                                        <span className={cn("text-sm text-fg-subtle", styles.rise)}>Không có sự cố</span>
                                    ) : (
                                        events.map((event, i) => {
                                            const Icon = event.icon;
                                            return (
                                                <span
                                                    key={event.key}
                                                    className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold ring-1 ring-inset", TONE_SOFT[event.tone], styles.rise)}
                                                    style={{ animationDelay: `${380 + i * 90}ms`, animationFillMode: "backwards" }}
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
                    <div className="flex min-h-10 items-center text-sm font-medium text-fg-muted">HLV tự chấm</div>
                    {ROUNDS.map((round) => {
                        const meta = SCORE_META[round.selfScore];
                        return (
                            <div key={round.roundNo} className="flex min-h-10 items-center" style={{ gridColumn: roundColumn(round.roundNo) }}>
                                {recorded >= round.roundNo && (
                                    <span className={cn("font-display text-lg font-bold", TONE_TEXT[meta.tone], styles.rise)} style={{ animationDelay: "520ms", animationFillMode: "backwards" }}>
                                        {meta.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {/* Playhead over the round and break columns; absolute, so it takes no grid cells */}
                    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ gridColumn: "2 / -1", gridRow: "1 / -1" }}>
                        <div
                            ref={playhead}
                            className={cn("absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-corner-red transition-opacity", step === 0 ? "opacity-0" : "opacity-100")}
                            style={{ left: "0%" }}
                        >
                            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-corner-red" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Corner advice, one card per break */}
            <div className="grid gap-px border-t border-border bg-border md:grid-cols-2">
                {ROUNDS.filter((r) => r.advice).map((round) => {
                    const state = recorded < round.roundNo ? "waiting" : resting === round.roundNo ? "live" : "given";
                    return (
                        <section key={round.roundNo} className={cn("bg-surface px-5 py-4 transition-colors", state === "live" && "bg-primary-soft/40")}>
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="font-display text-lg font-bold text-fg">Lời dặn sau hiệp {round.roundNo}</h3>
                                <span className="text-xs text-fg-subtle">{state === "waiting" ? "Chưa tới" : state === "live" ? "Đang nghỉ giữa hiệp" : "Đã dặn"}</span>
                            </div>
                            {state !== "waiting" && round.safetyRed && (
                                <p className={cn("mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset", TONE_SOFT.danger, styles.rise)}>
                                    <ShieldAlert aria-hidden className="size-4 shrink-0" />
                                    Cờ đỏ an toàn: đã choáng và bị hạ một lần trong hiệp {round.roundNo}
                                </p>
                            )}
                            {state === "waiting" ? (
                                <p className="mt-2 text-sm text-fg-subtle">Hiện khi tới giờ nghỉ sau hiệp {round.roundNo}.</p>
                            ) : (
                                <TypedLines key={`${round.roundNo}-${state === "live"}`} lines={round.advice ?? []} typing={state === "live" && !reduced} />
                            )}
                        </section>
                    );
                })}
            </div>

            {done && (
                <footer className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-surface-muted px-5 py-4 text-sm", styles.rise)}>
                    <span className="font-display text-xl font-extrabold text-fg italic">Thắng {wins}/3 hiệp theo HLV chấm</span>
                    <span className="text-fg-muted">Giữ được: jab đôi và đá thấp (3/3 hiệu quả)</span>
                    <span className="text-fg-muted">Bỏ: đổi southpaw sau hiệp 2</span>
                    <span className="text-fg-muted">Ép lưới vào ở hiệp 3, sau lời dặn</span>
                </footer>
            )}
        </div>
    );
}
