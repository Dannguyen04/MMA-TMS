"use client";

import { useEffect, useRef } from "react";

/** What a tick reports: "unchanged" backs off, "changed" resets to the base interval, nothing keeps the current delay. */
export type VisibleIntervalTick = "changed" | "unchanged" | void;

export interface VisibleIntervalOptions {
    /** Delay between ticks while the page is visible. */
    intervalMs: number;
    /** Upper bound when "unchanged" ticks double the delay. Defaults to `intervalMs` (no back-off). */
    maxIntervalMs?: number;
    /** False stops the timer. */
    enabled?: boolean;
}

/**
 * Runs `callback` repeatedly while the document is visible. Hidden tabs never tick; returning to the
 * tab runs the callback at once. Ticks never overlap: the next delay starts after an async callback
 * settles. A callback that throws keeps the current delay.
 */
export function useVisibleInterval(
    callback: () => VisibleIntervalTick | Promise<VisibleIntervalTick>,
    { intervalMs, maxIntervalMs = intervalMs, enabled = true }: VisibleIntervalOptions,
): void {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        let running = false;
        let timer: number | undefined;
        let delay = intervalMs;

        const schedule = () => {
            window.clearTimeout(timer);
            if (!cancelled && !document.hidden) timer = window.setTimeout(tick, delay);
        };

        const tick = async () => {
            if (cancelled || running || document.hidden) return;
            running = true;
            try {
                const result = await callbackRef.current();
                if (result === "changed") delay = intervalMs;
                if (result === "unchanged") delay = Math.min(delay * 2, Math.max(intervalMs, maxIntervalMs));
            } catch {
                // Keep the current delay; the next tick retries.
            } finally {
                running = false;
            }
            schedule();
        };

        const onVisibilityChange = () => {
            window.clearTimeout(timer);
            if (!document.hidden) void tick();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        schedule();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [enabled, intervalMs, maxIntervalMs]);
}
