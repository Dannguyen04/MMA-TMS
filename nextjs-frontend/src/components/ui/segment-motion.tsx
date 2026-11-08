"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/** Slides the indicator when the selected filter or tab changes. */
export function SegmentMotion({ as: Group = "nav", children, className, ...props }: ComponentPropsWithoutRef<"nav"> & { as?: "nav" | "div" }) {
    const navRef = useRef<HTMLElement>(null);
    const markerRef = useRef<HTMLSpanElement>(null);
    const previousKey = useRef<string | undefined>(undefined);
    const running = useRef<Animation | null>(null);

    useLayoutEffect(() => {
        const nav = navRef.current;
        const marker = markerRef.current;
        if (!nav || !marker) return;

        const selected = nav.querySelector<HTMLElement>('a[aria-current="page"], button[role="tab"][aria-selected="true"], button[data-segment][aria-pressed="true"]');
        const selectedKey = selected?.getAttribute("href") ?? selected?.dataset.segment ?? selected?.id;
        const oldKey = previousKey.current;
        previousKey.current = selectedKey;
        if (oldKey === selectedKey) return;
        running.current?.cancel();
        if (!oldKey || !selected || typeof marker.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const previous = [...nav.querySelectorAll<HTMLElement>('a[href], button[role="tab"], button[data-segment]')].find(
            (item) => (item.getAttribute("href") ?? item.dataset.segment ?? item.id) === oldKey,
        );
        if (!previous) return;

        const bounds = nav.getBoundingClientRect();
        const from = previous.getBoundingClientRect();
        const to = selected.getBoundingClientRect();
        if (!from.width || !to.width) return;

        marker.style.left = `${to.left - bounds.left + nav.scrollLeft}px`;
        marker.style.top = `${to.bottom - bounds.top + nav.scrollTop - 2}px`;
        marker.style.width = `${to.width}px`;
        running.current = marker.animate(
            [
                { opacity: 0.85, transform: `translate(${from.left - to.left}px, ${from.bottom - to.bottom}px) scaleX(${from.width / to.width})` },
                { opacity: 1, transform: "none", offset: 0.78 },
                { opacity: 0, transform: "none" },
            ],
            { duration: 240, easing: "cubic-bezier(0.2, 0.75, 0.25, 1)" },
        );
    });

    useLayoutEffect(() => () => running.current?.cancel(), []);

    return (
        <Group {...props} ref={(element) => { navRef.current = element; }} className={cn("segment-motion", className)}>
            {children}
            <span aria-hidden className="segment-motion-marker" ref={markerRef} />
        </Group>
    );
}
