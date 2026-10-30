"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ReplayTiming {
    /** Seconds a round takes on screen. */
    round: number;
    /** Seconds a corner break takes on screen. */
    rest: number;
}

/** Visual widths on the track: a five-minute round against a one-minute break, with the break widened to stay readable. */
export const ROUND_WEIGHT = 5;
export const REST_WEIGHT = 1.7;

/** Track position (0–1) where each step starts. Step 0 and 1 both start at 0. */
export function trackStart(step: number, rounds: number): number {
    const total = rounds * ROUND_WEIGHT + (rounds - 1) * REST_WEIGHT;
    if (step <= 1) return 0;
    const finished = Math.floor(step / 2);
    const inBreak = step % 2 === 0;
    const used = finished * ROUND_WEIGHT + (inBreak ? finished - 1 : finished) * REST_WEIGHT;
    return Math.min(1, used / total);
}

/**
 * Drives a replay with one GSAP timeline over `rounds` rounds: odd steps are a round being fought, the
 * even step after it is that round's record arriving and the corner break (none after the last).
 * `step` re-renders the page only at step changes; the playhead and the break countdown move every
 * frame through refs, without React.
 */
export function useReplay({ rounds, timing, reduced, onFrame }: { rounds: number; timing: ReplayTiming; reduced: boolean; onFrame?: (progress: number, breakLeft: number | null) => void }) {
    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);
    const timeline = useRef<gsap.core.Timeline | null>(null);
    const frame = useRef(onFrame);

    useEffect(() => {
        frame.current = onFrame;
    }, [onFrame]);

    useEffect(() => {
        const state = { p: 0, rest: 1 };
        const report = (inBreak: boolean) => frame.current?.(state.p, inBreak ? state.rest : null);
        const tl = gsap.timeline({ paused: true, onComplete: () => setPlaying(false) });
        const ease = reduced ? "steps(1)" : "none";
        for (let r = 1; r <= rounds; r++) {
            const fightStep = 2 * r - 1;
            tl.addLabel(`s${fightStep}`).call(() => setStep(fightStep));
            tl.to(state, { p: trackStart(fightStep + 1, rounds), duration: timing.round, ease, onUpdate: () => report(false) });
            if (r === rounds) {
                tl.addLabel(`s${2 * r}`).call(() => setStep(2 * r));
                break;
            }
            tl.addLabel(`s${2 * r}`).call(() => setStep(2 * r));
            tl.set(state, { rest: 1 });
            tl.to(state, {
                p: trackStart(2 * r + 1, rounds),
                rest: 0,
                duration: timing.rest,
                ease,
                onUpdate: () => report(true),
            });
        }
        timeline.current = tl;
        return () => {
            tl.kill();
        };
    }, [rounds, timing.round, timing.rest, reduced]);

    const play = useCallback(() => {
        const tl = timeline.current;
        if (!tl) return;
        if (tl.progress() >= 1) {
            tl.seek(0);
            setStep(0);
        }
        tl.play();
        setPlaying(true);
    }, []);

    const pause = useCallback(() => {
        timeline.current?.pause();
        setPlaying(false);
    }, []);

    /** Jumps to a step and stays paused there. */
    const seek = useCallback(
        (target: number) => {
            const tl = timeline.current;
            if (!tl) return;
            tl.pause();
            setPlaying(false);
            if (target <= 0) {
                tl.seek(0, true);
                setStep(0);
                frame.current?.(0, null);
                return;
            }
            const lastStep = rounds * 2;
            const clamped = Math.min(target, lastStep);
            // Land just after the step's own label: a recorded round sits at the start of its break, so Play runs the break on.
            if (clamped >= lastStep) tl.progress(1, true);
            else tl.seek(tl.labels[`s${clamped}`] + 0.001, true);
            setStep(clamped);
            frame.current?.(trackStart(clamped, rounds), clamped % 2 === 0 ? 1 : null);
        },
        [rounds],
    );

    return { step, playing, play, pause, seek };
}
