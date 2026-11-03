"use client";

import { Info, Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { TONE_FILL, TONE_SOFT } from "@/components/ui/tone";
import { cn } from "@/lib/utils";
import { BodyStage, type StageHighlight } from "@/components/fighter-3d/body/body-stage";
import { LAB_FIGHTER, type LabRound } from "../lab-data";
import styles from "../lab.module.css";
import { useReducedMotion } from "@/components/fighter-3d/use-graphics";
import { LAST_STEP, OUTCOME_META, ROUNDS, SCORE_META, TACTICS, breakAfter, roundEvents, roundInProgress, roundsRecorded } from "./replay-model";
import { TypedLines } from "@/components/replay/typed-lines";
import { useReplay } from "@/components/replay/use-replay";

const TIMING = { round: 3.4, rest: 4.2 };

/** What the corner recorded about the fighter's body in a round. Only fields the round record has. */
function bodyAfter(round: LabRound | undefined): { highlights: StageHighlight[]; dim: number } {
    if (!round) return { highlights: [], dim: 1 };
    const head: string[] = [];
    if (round.knockdownsAgainst > 0) head.push(`bị hạ ${round.knockdownsAgainst}`);
    if (round.stunned) head.push("choáng");
    if (round.bleeding) head.push("chảy máu");
    const severe = round.knockdownsAgainst > 0 || round.stunned;
    const highlights: StageHighlight[] = head.length
        ? [{ region: "head", tone: severe ? "danger" : "warning", label: head.join(", "), pulse: severe, pinned: true }]
        : [];
    return { highlights, dim: round.fatigued ? 0.58 : 1 };
}

export function BodyRoundsReplay() {
    const reduced = useReducedMotion();
    const clock = useRef<HTMLSpanElement>(null);
    const onFrame = useCallback((_: number, breakLeft: number | null) => {
        if (clock.current && breakLeft !== null) clock.current.textContent = `${Math.ceil(breakLeft * 60)} s`;
    }, []);
    const { step, playing, play, pause, seek } = useReplay({ rounds: ROUNDS.length, timing: TIMING, reduced, onFrame });

    const recorded = roundsRecorded(step);
    const live = roundInProgress(step);
    const resting = breakAfter(step);
    const done = step >= LAST_STEP;
    const shownRound = recorded > 0 ? ROUNDS[recorded - 1] : undefined;
    const body = useMemo(() => bodyAfter(shownRound), [shownRound]);
    const heading = live ? `Hiệp ${live}` : resting ? `Nghỉ sau hiệp ${resting}` : done ? "Hết trận" : "Trước trận";

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <BodyStage
                look="hologram"
                model="muscular"
                highlights={body.highlights}
                dim={body.dim}
                scanKey={recorded}
                className="h-[520px] sm:h-[580px]"
                ariaLabel={`Tình trạng cơ thể ${LAB_FIGHTER.name} qua từng hiệp`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div key={heading} className={styles.rise}>
                        <p className="font-display text-[34px] leading-none font-extrabold text-fg italic">{heading}</p>
                        <p className="mt-1 text-[13px] text-fg-muted">
                            {resting ? (
                                <>
                                    Góc đài còn <span ref={clock} className="font-semibold text-fg tabular-nums">60 s</span>
                                </>
                            ) : live ? (
                                "Đang đấu, chờ HLV ghi cuối hiệp"
                            ) : done ? (
                                "Cơ thể sau hiệp cuối"
                            ) : (
                                "Bấm Phát để diễn lại"
                            )}
                        </p>
                    </div>
                    {shownRound?.fatigued && (
                        <span className={cn("rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset", TONE_SOFT.warning, styles.rise)}>Mệt cuối hiệp {shownRound.roundNo}</span>
                    )}
                </div>
            </BodyStage>

            <div className="flex min-w-0 flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-[22px] leading-6 font-extrabold text-fg italic">
                        {LAB_FIGHTER.name.split(" ").at(-1)} <span className="font-semibold text-fg-subtle not-italic">vs</span> {LAB_FIGHTER.opponent.split(" ").at(-1)}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="icon" aria-label="Phát lại từ đầu" onClick={() => seek(0)} disabled={step === 0 && !playing}>
                            <RotateCcw aria-hidden />
                        </Button>
                        <Button onClick={playing ? pause : play} className="min-w-28">
                            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                            {playing ? "Tạm dừng" : done ? "Phát lại" : step === 0 ? "Phát" : "Tiếp tục"}
                        </Button>
                    </div>
                </div>

                <ol className="flex flex-col gap-2">
                    {ROUNDS.map((round) => {
                        const isRecorded = recorded >= round.roundNo;
                        const isLive = live === round.roundNo;
                        const score = SCORE_META[round.selfScore];
                        const events = roundEvents(round);
                        return (
                            <li key={round.roundNo}>
                                <button
                                    type="button"
                                    onClick={() => seek(round.roundNo * 2)}
                                    className={cn(
                                        "w-full rounded-xl border bg-surface px-4 py-3 text-left shadow-card transition-[border-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                        isLive ? "border-primary" : recorded === round.roundNo ? "border-border-strong" : "border-border",
                                        !isRecorded && !isLive && "opacity-60",
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-3">
                                        <span className="font-display text-lg font-bold text-fg">Hiệp {round.roundNo}</span>
                                        {isRecorded ? (
                                            <span className={cn("rounded-md px-2 text-xs leading-6 font-semibold ring-1 ring-inset", TONE_SOFT[score.tone], styles.rise)}>{score.label}</span>
                                        ) : (
                                            <span className="text-xs text-fg-subtle">{isLive ? "Đang đấu" : "Chưa diễn ra"}</span>
                                        )}
                                    </span>
                                    <span className="mt-2 flex items-center gap-1.5" aria-label="Chiến thuật trong hiệp">
                                        {TACTICS.map((tactic, i) => {
                                            const meta = OUTCOME_META[round.tacticMarks[tactic.id]];
                                            return (
                                                <span
                                                    key={tactic.id}
                                                    title={`${tactic.text}: ${meta.label}`}
                                                    className={cn(
                                                        "h-1.5 flex-1 origin-left rounded-full transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                                        isRecorded ? TONE_FILL[meta.tone] : "bg-surface-hover",
                                                        isRecorded ? "scale-x-100" : "scale-x-[0.15] motion-reduce:scale-x-100",
                                                    )}
                                                    style={{ transitionDelay: isRecorded ? `${i * 120}ms` : "0ms" }}
                                                />
                                            );
                                        })}
                                    </span>
                                    {isRecorded && events.length > 0 && (
                                        <span className="mt-2 flex flex-wrap gap-1.5">
                                            {events.map((event) => {
                                                const Icon = event.icon;
                                                return (
                                                    <span key={event.key} className={cn("inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-semibold ring-1 ring-inset", TONE_SOFT[event.tone], styles.rise)}>
                                                        <Icon aria-hidden className="size-3.5" />
                                                        {event.label}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-hidden>
                    {(["EFFECTIVE", "INEFFECTIVE", "NOT_USED"] as const).map((outcome) => (
                        <span key={outcome} className="inline-flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-4 rounded-full", TONE_FILL[OUTCOME_META[outcome].tone])} />
                            {OUTCOME_META[outcome].label}
                        </span>
                    ))}
                </div>

                {shownRound?.advice && (
                    <section key={shownRound.roundNo} className={cn("rounded-xl border border-border bg-surface px-4 py-3 shadow-card", styles.rise)}>
                        <h3 className="font-display text-lg font-bold text-fg">Lời dặn sau hiệp {shownRound.roundNo}</h3>
                        {shownRound.safetyRed && (
                            <p className={cn("mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset", TONE_SOFT.danger)}>
                                <ShieldAlert aria-hidden className="size-4 shrink-0" />
                                Cờ đỏ an toàn: choáng thêm lần nữa là bác sĩ dừng trận
                            </p>
                        )}
                        <TypedLines key={`${shownRound.roundNo}-${resting === shownRound.roundNo}`} lines={shownRound.advice} typing={resting === shownRound.roundNo && !reduced} />
                    </section>
                )}

                <p className="flex gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-fg-muted">
                    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    Hiện app chỉ ghi choáng, bị hạ, chảy máu và mệt cho cả hiệp. Nếu màn ghi hiệp (T-037) cho chạm vào vùng bị đánh trúng, các vùng đó sẽ sáng lên trên cơ thể ở đây.
                </p>
            </div>
        </div>
    );
}
