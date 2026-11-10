"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { plural } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

import { sectorPath, type ProgressStep, type StepState } from "./exam-progress";

const FILL: Record<StepState, string> = { todo: "fill-primary", part: "fill-primary", need: "fill-danger-solid", done: "fill-success-solid" };
const RING: Record<StepState, string> = { todo: "stroke-control-border", part: "stroke-control-border", need: "stroke-danger-solid", done: "stroke-success-solid" };

/**
 * A circle whose inside fills with the part's progress, from twelve o'clock counter-clockwise. It eases between values;
 * when the part completes it fills solid, draws a tick and bounces once. Reduced motion skips both animations.
 */
export function ProgressPie({ pct, state }: { pct: number; state: StepState }) {
    const [shown, setShown] = useState(pct);
    const shownRef = useRef(pct);
    const [pop, setPop] = useState(false);
    const wasDone = useRef(state === "done");

    useEffect(() => {
        const from = shownRef.current;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || document.hidden || from === pct) {
            shownRef.current = pct;
            setShown(pct);
            return;
        }
        let raf = 0;
        const start = performance.now();
        const step = (now: number) => {
            const k = Math.min(1, (now - start) / 450);
            const value = from + (pct - from) * (1 - Math.pow(1 - k, 3));
            shownRef.current = value;
            setShown(value);
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        // Settle on the final value even when the browser pauses frames (a hidden tab).
        const settle = window.setTimeout(() => {
            cancelAnimationFrame(raf);
            shownRef.current = pct;
            setShown(pct);
        }, 500);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(settle);
        };
    }, [pct]);

    useEffect(() => {
        const done = state === "done";
        if (done && !wasDone.current) setPop(true);
        wasDone.current = done;
    }, [state]);

    return (
        <span aria-hidden className={cn("grid size-5 shrink-0", pop && "motion-safe:animate-[pie-pop_.55s_cubic-bezier(.34,1.56,.64,1)]")} onAnimationEnd={() => setPop(false)}>
            <svg viewBox="0 0 20 20" className="size-5 overflow-visible">
                <circle cx="10" cy="10" r="9" className={cn("fill-none stroke-[1.5] transition-[stroke] duration-300", RING[state])} />
                <path d={sectorPath(shown)} className={cn("transition-[fill] duration-300", FILL[state])} />
                <path
                    d="M6 10.4l2.7 2.7L14.2 7.6"
                    className={cn(
                        "fill-none stroke-white stroke-[2.2] [stroke-dasharray:12] [stroke-linecap:round] [stroke-linejoin:round] motion-safe:transition-[stroke-dashoffset] motion-safe:delay-150 motion-safe:duration-300",
                        state === "done" ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:12]",
                    )}
                />
            </svg>
        </span>
    );
}

/**
 * A form's side column: an optional visual on top, each part with its progress (linking to `#{anchorPrefix}{key}`), the
 * overall bar, and the save and cancel actions.
 */
export function ExamProgressRail({
    steps,
    actions,
    footer,
    top,
    title,
    label,
    anchorPrefix = "exam-",
}: {
    steps: readonly ProgressStep[];
    actions: ReactNode;
    footer?: ReactNode;
    top?: ReactNode;
    title?: string;
    label?: string;
    anchorPrefix?: string;
}) {
    const t = useT();
    const total = steps.reduce((sum, step) => sum + step.pct, 0) / steps.length;
    const left = steps.filter((step) => step.state !== "done").length;
    return (
        <aside aria-label={label ?? t("doctorMedical.progress.railLabel")} className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface shadow-card">
            {top}
            <div className="flex flex-col gap-3 px-5 py-4">
                <h2 className="text-[13px] font-semibold text-fg-muted">{title ?? t("doctorMedical.progress.railTitle")}</h2>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-soft" aria-hidden>
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${Math.round(total * 100)}%` }} />
                </div>
                <ol className="flex flex-col">
                    {steps.map((step) => (
                        <li key={step.key}>
                            <a
                                href={`#${anchorPrefix}${step.key}`}
                                aria-label={`${step.label}: ${step.text}`}
                                className="-mx-2 grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-fg hover:bg-surface-muted"
                            >
                                <ProgressPie pct={Math.max(0, Math.min(1, step.pct))} state={step.state} />
                                {step.label}
                                <small
                                    className={cn(
                                        "max-w-40 truncate text-right text-[12.5px] font-medium",
                                        step.state === "need" ? "font-semibold text-danger-fg" : step.state === "done" ? "text-success-fg" : "text-fg-subtle",
                                    )}
                                >
                                    {step.text}
                                </small>
                            </a>
                        </li>
                    ))}
                </ol>
            </div>
            <div className="flex flex-col gap-2.5 px-5 py-4">
                {actions}
                <p className="text-[13px] text-fg-muted" aria-live="polite">
                    {left ? plural(t, "doctorMedical.progress.left", left) : t("doctorMedical.progress.complete")}
                </p>
            </div>
            {footer && <div className="px-5 py-4 text-[13px] leading-relaxed text-fg-muted">{footer}</div>}
        </aside>
    );
}
