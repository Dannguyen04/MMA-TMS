import Image from "next/image";

import { cn } from "@/lib/utils";
import logoMark from "./logo-mark.webp";

/**
 * The glove mark (AI crosshair on the glove, red strike trail) cut to the octagon. Decorative: the
 * wordmark or the surrounding link's label carries the name.
 */
export function LogoMark({ className }: { className?: string }) {
    return <Image src={logoMark} alt="" aria-hidden loading="eager" className={cn("octagon size-8 shrink-0 bg-black object-cover", className)} />;
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
