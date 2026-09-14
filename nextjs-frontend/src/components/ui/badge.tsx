import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { TONE_SOFT, TONE_SOLID, type Tone } from "./tone";

export interface BadgeProps {
    tone?: Tone;
    variant?: "soft" | "solid" | "outline";
    size?: "sm" | "md";
    icon?: LucideIcon;
    /** Replaces the icon with a small dot. */
    dot?: boolean;
    className?: string;
    children: ReactNode;
    title?: string;
}

export function Badge({ tone = "neutral", variant = "soft", size = "md", icon: Icon, dot, className, children, title }: BadgeProps) {
    return (
        <span
            title={title}
            className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-md font-medium whitespace-nowrap ring-1 ring-inset",
                size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
                variant === "solid" && TONE_SOLID[tone],
                variant === "soft" && TONE_SOFT[tone],
                variant === "outline" && cn(TONE_SOFT[tone], "bg-transparent"),
                className,
            )}
        >
            {Icon && <Icon aria-hidden className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.25} />}
            {!Icon && dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
            <span className="truncate">{children}</span>
        </span>
    );
}
