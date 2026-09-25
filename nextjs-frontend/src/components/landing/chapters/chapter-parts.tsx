import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Mono chapter index and label above each chapter heading, e.g. "01 — AI analysis". */
export function Kicker({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
    return (
        <p data-reveal className={cn("flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-landing-cyan uppercase", className)}>
            {index && <span>{index}</span>}
            <span aria-hidden className="h-px w-10 shrink-0 bg-current opacity-50" />
            <span>{children}</span>
        </p>
    );
}

/** Chapter heading; `data-split` lets the motion layer reveal it line by line. */
export function ChapterTitle({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
    return (
        <h2 id={id} data-split className={cn("mt-4 text-[clamp(2.1rem,4.4vw,4rem)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance text-white", className)}>
            {children}
        </h2>
    );
}

/** Frosted panel that keeps copy readable over the 3D stage. */
export function Panel({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("rounded-2xl border border-white/10 bg-landing-ink/55 shadow-[0_24px_80px_-32px_rgb(0_0_0/0.9)] backdrop-blur-xl", className)} {...props}>
            {children}
        </div>
    );
}

/** A small caption that marks illustrative numbers as sample data. */
export function SampleTag({ children = "Sample analysis" }: { children?: ReactNode }) {
    return <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-nav-fg/70 uppercase">{children}</span>;
}

export const TONE_TEXT = {
    success: "text-landing-success",
    warning: "text-landing-warning",
    danger: "text-landing-danger",
    info: "text-landing-cyan",
} as const;

export const TONE_BG = {
    success: "bg-landing-success",
    warning: "bg-landing-warning",
    danger: "bg-landing-danger",
    info: "bg-landing-cyan",
} as const;
