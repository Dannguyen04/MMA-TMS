"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { ChartSurfaceHandlers } from "./use-active-index";
import { useChartWidth } from "./use-chart-width";

interface ChartSurfaceProps {
    ariaLabel: string;
    /** Fixed height of the drawing, including axis bands, so the page never shifts. */
    height: number;
    /** Screen-reader instructions for the keyboard interaction. */
    keyboardHint: string;
    /** Politely announced text describing the keyboard-selected data (empty for pointer hover). */
    announcement: string;
    handlers: ChartSurfaceHandlers;
    /** Renders the chart once the available width is known. */
    children: (width: number) => ReactNode;
    className?: string;
}

/**
 * Focusable, measured container for interactive SVG charts. Owns the keyboard focus ring,
 * the screen-reader hint and the live region; draws nothing until the width is measured, and
 * the drawing is absolutely positioned so the container always follows its parent's width.
 */
export function ChartSurface({ ariaLabel, height, keyboardHint, announcement, handlers, children, className }: ChartSurfaceProps) {
    const { ref, width } = useChartWidth<HTMLDivElement>();
    const hintId = useId();

    return (
        <div
            ref={ref}
            role="group"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-describedby={hintId}
            className={cn("relative w-full rounded-md select-none", className)}
            style={{ height }}
            {...handlers}
        >
            <span id={hintId} className="sr-only">
                {keyboardHint}
            </span>
            <span className="sr-only" aria-live="polite">
                {announcement}
            </span>
            {/* Out of flow so the fixed-width drawing never props up the container's min-content width. */}
            {width !== null && width > 0 && <div className="absolute inset-0">{children(width)}</div>}
        </div>
    );
}
