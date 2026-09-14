"use client";

import { useState, type FocusEvent, type KeyboardEvent } from "react";

/** How the reader reached the active data position. Keyboard moves are announced to screen readers. */
type ActiveSource = "pointer" | "keyboard";

interface ActiveTarget {
    index: number;
    source: ActiveSource;
}

/** Event handlers for the focusable chart surface. */
export interface ChartSurfaceHandlers {
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
    onPointerLeave: () => void;
}

interface ActiveIndexOptions {
    /** Arrow keys wrap from the last target to the first (radar axes). */
    wrap?: boolean;
    /** Target activated when the surface receives keyboard focus. Defaults to the last (most recent). */
    initial?: "first" | "last";
}

/**
 * Shared hover/keyboard state for interactive charts: the pointer or ArrowLeft/ArrowRight
 * (plus Home/End, Escape) pick one of `count` targets. Tooltips render from `active`.
 */
export function useActiveIndex(count: number, { wrap = false, initial = "last" }: ActiveIndexOptions = {}) {
    const [state, setState] = useState<ActiveTarget | null>(null);
    const active = state && state.index < count ? state : null;

    const move = (index: number) => setState({ index, source: "keyboard" });

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (count === 0) return;
        const last = count - 1;
        const current = active?.index;
        switch (event.key) {
            case "ArrowRight":
                if (current === undefined) move(0);
                else move(current === last ? (wrap ? 0 : last) : current + 1);
                break;
            case "ArrowLeft":
                if (current === undefined) move(last);
                else move(current === 0 ? (wrap ? last : 0) : current - 1);
                break;
            case "Home":
                move(0);
                break;
            case "End":
                move(last);
                break;
            case "Escape":
                setState(null);
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    const onFocus = (event: FocusEvent<HTMLElement>) => {
        if (count === 0 || event.target !== event.currentTarget || !event.currentTarget.matches(":focus-visible")) return;
        setState((previous) => previous ?? { index: initial === "first" ? 0 : count - 1, source: "keyboard" });
    };

    const onBlur = (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) setState(null);
    };

    const onPointerLeave = () => setState((previous) => (previous?.source === "pointer" ? null : previous));

    const pointAt = (index: number) => {
        if (index < 0 || index >= count) return;
        setState((previous) => (previous?.index === index && previous.source === "pointer" ? previous : { index, source: "pointer" }));
    };

    const handlers: ChartSurfaceHandlers = { onKeyDown, onFocus, onBlur, onPointerLeave };
    return { active, pointAt, handlers };
}
