"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 100;

export interface TooltipProps {
    content: ReactNode;
    /**
     * A single focusable element (button, link); it receives `aria-describedby`. Render the Tooltip from a
     * client component so the child arrives as an element rather than a server reference.
     */
    children: ReactElement<{ "aria-describedby"?: string }>;
    side?: "top" | "bottom";
    className?: string;
}

/**
 * Supplementary text shown on hover and keyboard focus. The trigger is described by the tooltip even
 * while it is hidden, so screen readers never depend on hovering. The bubble can be hovered, and
 * Escape dismisses it.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<number | undefined>(undefined);

    const show = () => {
        window.clearTimeout(closeTimer.current);
        setOpen(true);
    };
    const hide = () => {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
    };

    useEffect(() => () => window.clearTimeout(closeTimer.current), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            window.clearTimeout(closeTimer.current);
            setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    const trigger = isValidElement(children)
        ? cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" ") })
        : children;

    return (
        <span className={cn("relative inline-flex", className)} onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
            {trigger}
            <span
                id={id}
                role="tooltip"
                hidden={!open}
                className={cn("absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2", side === "top" ? "bottom-full pb-1.5" : "top-full pt-1.5")}
            >
                <span className="block rounded-md bg-nav-bg px-2 py-1 text-xs font-medium text-white shadow-popover">{content}</span>
            </span>
        </span>
    );
}
