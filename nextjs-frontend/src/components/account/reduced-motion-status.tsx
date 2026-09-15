"use client";

import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "./use-media-query";

/** Shows whether the operating system currently asks for reduced motion. */
export function ReducedMotionStatus() {
    const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
    if (reduce === null) {
        return (
            <Badge tone="neutral" variant="outline">
                Checking…
            </Badge>
        );
    }
    return (
        <Badge tone={reduce ? "success" : "neutral"} dot>
            {reduce ? "On — motion reduced" : "Off — standard motion"}
        </Badge>
    );
}
