import { cn } from "@/lib/utils";

/** Octagon mark: red and blue corners meeting in the cage. */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
            <path d="M9.4 1h13.2L31 9.4v13.2L22.6 31H9.4L1 22.6V9.4Z" className="fill-nav-surface" />
            <path d="M16 1H9.4L1 9.4v13.2L9.4 31H16" fill="none" strokeWidth="2.4" className="stroke-brand-red" />
            <path d="M16 1h6.6L31 9.4v13.2L22.6 31H16" fill="none" strokeWidth="2.4" className="stroke-brand-blue" />
            <path d="M12.2 8.5h7.6l4.7 4.7v5.6l-4.7 4.7h-7.6l-4.7-4.7v-5.6Z" fill="none" strokeWidth="1.6" className="stroke-white/85" />
        </svg>
    );
}

/**
 * Mark plus wordmark. `stage` is for the fixed dark grounds (landing, sign-in aside); `rail` follows the
 * app's navigation rail, which is light in the light theme and navy in the dark one.
 */
export function Logo({ className, subtitle = true, ground = "stage" }: { className?: string; subtitle?: boolean; ground?: "stage" | "rail" }) {
    const rail = ground === "rail";
    return (
        <span className={cn("flex items-center gap-2.5", className)}>
            <LogoMark />
            <span className="flex flex-col leading-none">
                <span className={cn("font-display text-[19px] font-extrabold tracking-[0.01em] italic", rail ? "text-rail-fg-strong" : "text-white")}>MMA-TMS</span>
                {subtitle && <span className={cn("mt-0.5 text-[11px]", rail ? "text-rail-muted" : "text-nav-fg")}>Training &amp; Health</span>}
            </span>
        </span>
    );
}
