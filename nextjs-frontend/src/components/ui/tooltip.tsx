"use client";

import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 100;
/** Space kept between the bubble and the edge of the screen. */
const EDGE_GAP_PX = 8;

export interface TooltipProps {
    content: ReactNode;
    /**
     * A single focusable element (button, link); it receives `aria-describedby`. Render the Tooltip from a
     * client component so the child arrives as an element rather than a server reference.
     */
    children: ReactElement<{ "aria-describedby"?: string }>;
    side?: "top" | "bottom";
    /** "start" lines the bubble up with the trigger's left edge, for triggers near the left of a narrow screen. */
    align?: "center" | "start";
    className?: string;
}

/**
 * Supplementary text shown on hover and keyboard focus. The trigger is described by the tooltip even
 * while it is hidden, so screen readers never depend on hovering. The bubble can be hovered, and
 * Escape dismisses it.
 */
export function Tooltip({ content, children, side = "top", align = "center", className }: TooltipProps) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<number | undefined>(undefined);
    const bubble = useRef<HTMLSpanElement>(null);
    const root = useRef<HTMLSpanElement>(null);

    const show = () => {
        window.clearTimeout(closeTimer.current);
        setOpen(true);
    };
    const hide = () => {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
    };

    useEffect(() => () => window.clearTimeout(closeTimer.current), []);

    // Nudges the bubble back inside the screen when the trigger sits near an edge, e.g. on a phone.
    useLayoutEffect(() => {
        const element = bubble.current;
        if (!open || !element) return;
        element.style.translate = "";
        const rect = element.getBoundingClientRect();
        // clientWidth, not innerWidth: on a phone an overflowing bubble widens the page, and innerWidth with it.
        const overRight = rect.right - (document.documentElement.clientWidth - EDGE_GAP_PX);
        const shift = overRight > 0 ? -Math.min(overRight, rect.left - EDGE_GAP_PX) : rect.left < EDGE_GAP_PX ? EDGE_GAP_PX - rect.left : 0;
        if (shift) element.style.translate = `${shift}px 0`;
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = () => {
            window.clearTimeout(closeTimer.current);
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        // A tap anywhere else closes it: touch has no hover to leave.
        const onPointerDown = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) close();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    const trigger = isValidElement(children)
        ? cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" ") })
        : children;

    return (
        <span
            ref={root}
            className={cn("relative inline-flex", className)}
            onPointerEnter={show}
            // A finger "leaves" as soon as the tap ends, which would close the bubble before it can be read.
            onPointerLeave={(event) => event.pointerType !== "touch" && hide()}
            onFocus={show}
            onBlur={hide}
        >
            {trigger}
            <span
                id={id}
                role="tooltip"
                hidden={!open}
                className={cn(
                    "absolute z-50 w-max max-w-[min(16rem,calc(100vw-1rem))]",
                    align === "start" ? "-left-1" : "left-1/2 -translate-x-1/2",
                    side === "top" ? "bottom-full pb-1.5" : "top-full pt-1.5",
                )}
            >
                <span ref={bubble} className="block rounded-md bg-fg px-2 py-1 text-xs font-medium text-fg-inverse shadow-popover">{content}</span>
            </span>
        </span>
    );
}
