import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One row of readiness facts joined by hairlines, like a broadcast "tale of the tape". The grid is
 * 2 columns on phones, 6 on tablets and 5 on desktop; give each cell its span through `className`.
 */
export function ReadinessStrip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <section
            aria-label={label}
            className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card sm:grid-cols-6 lg:grid-cols-5", className)}
        >
            {children}
        </section>
    );
}

export interface ReadinessCellProps {
    label: string;
    /** The fact itself: a status badge or a `ReadinessNumber`. */
    value: ReactNode;
    hint?: ReactNode;
    /** Where the full story lives. The whole cell becomes the link. */
    href?: string;
    /** Optional visual under the hint, e.g. a meter. */
    children?: ReactNode;
    className?: string;
}

export function ReadinessCell({ label, value, hint, href, children, className }: ReadinessCellProps) {
    const body = (
        <>
            <span className="font-display text-[13px] leading-5 font-bold tracking-[0.08em] text-fg-subtle uppercase">{label}</span>
            <span className="flex min-h-8 flex-wrap items-center gap-x-1.5 gap-y-1">{value}</span>
            {hint && <span className="text-[13px] text-pretty text-fg-muted">{hint}</span>}
            {children && <span className="mt-auto block pt-1.5">{children}</span>}
        </>
    );
    const classes = cn("flex min-w-0 flex-col gap-1 bg-surface px-4 py-3.5", className);

    return href ? (
        <Link href={href} className={cn(classes, "transition-colors hover:bg-surface-muted focus-visible:-outline-offset-2")}>
            {body}
        </Link>
    ) : (
        <div className={classes}>{body}</div>
    );
}

/** Big broadcast-style figure for a readiness cell, e.g. "68.9 kg" or "7 of 8". */
export function ReadinessNumber({ value, unit }: { value: ReactNode; unit?: string }) {
    return (
        <span className="flex items-baseline gap-1">
            <span className="font-display text-[30px] leading-none font-extrabold tracking-tight text-fg italic">{value}</span>
            {unit && <span className="text-sm font-medium text-fg-muted">{unit}</span>}
        </span>
    );
}
