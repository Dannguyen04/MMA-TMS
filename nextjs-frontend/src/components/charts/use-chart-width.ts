"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Measures an element's content width with a ResizeObserver so charts can draw at 1:1
 * pixels (SVG text is never scaled). Width is `null` until the first measurement — on the
 * server and during hydration — so render a fixed-height placeholder until then.
 */
export function useChartWidth<T extends HTMLElement>(): { ref: RefObject<T | null>; width: number | null } {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState<number | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (entry) setWidth(Math.floor(entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width };
}
