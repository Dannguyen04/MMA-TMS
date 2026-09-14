"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PopoverTriggerProps {
    id: string;
    "aria-expanded": boolean;
    /** Only set while the panel is rendered, so it never points at a missing element. */
    "aria-controls"?: string;
    "aria-haspopup": "dialog" | "menu";
    onClick: () => void;
}

export interface PopoverProps {
    /** Renders the trigger; spread `props` onto a <button>. */
    trigger: (props: PopoverTriggerProps) => ReactNode;
    children: (close: () => void) => ReactNode;
    align?: "start" | "end";
    side?: "bottom" | "top";
    label: string;
    kind?: "dialog" | "menu";
    className?: string;
}

/** Anchored panel that closes on outside click, Escape, focus leaving it, or navigation inside it. */
export function Popover({ trigger, children, align = "end", side = "bottom", label, kind = "dialog", className }: PopoverProps) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const triggerId = useId();
    const rootRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => {
        setOpen(false);
        document.getElementById(triggerId)?.focus();
    }, [triggerId]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, close]);

    return (
        <div
            ref={rootRef}
            className="relative"
            onBlur={(event) => {
                // Tabbing past the panel closes it; focus stays where the user moved it.
                const next = event.relatedTarget;
                if (open && next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
            }}
        >
            {trigger({
                id: triggerId,
                "aria-expanded": open,
                "aria-controls": open ? panelId : undefined,
                "aria-haspopup": kind,
                onClick: () => setOpen((value) => !value),
            })}
            {open && (
                <div
                    id={panelId}
                    role={kind === "dialog" ? "dialog" : undefined}
                    aria-label={label}
                    className={cn(
                        "absolute z-50 rounded-xl border border-border bg-surface text-fg shadow-popover",
                        align === "end" ? "right-0" : "left-0",
                        side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
                        className,
                    )}
                >
                    {children(close)}
                </div>
            )}
        </div>
    );
}
