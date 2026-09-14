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

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
    return (
        <span className={cn("flex items-center gap-2.5", className)}>
            <LogoMark />
            <span className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold tracking-tight text-white">MMA-TMS</span>
                {subtitle && <span className="mt-1 text-[11px] text-nav-fg">Training &amp; Health</span>}
            </span>
        </span>
    );
}
